import { createHash, randomInt } from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { isValidIndianPhone, normalizePhone } from '../../lib/phone.js';
import { createAdminToken } from '../../lib/admin-jwt.js';
import { adminAuthService } from './admin-auth.service.js';
import { deliverOtpWhatsApp } from './otp-whatsapp.service.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_SEND_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(code: string, phone: string): string {
  return createHash('sha256').update(`${phone}:${code}:${env.ADMIN_JWT_SECRET}`).digest('hex');
}

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

function tenDigitPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}

function profilePhoneMatches(profile: Record<string, unknown>, ten: string): boolean {
  for (const field of ['personal_mobile', 'company_whatsapp', 'alternate_mobile']) {
    const value = profile[field];
    if (value && tenDigitPhone(String(value)) === ten) return true;
  }
  return false;
}

async function findActiveAdminByPhone(phoneRaw: string) {
  const ten = tenDigitPhone(phoneRaw);
  if (ten.length !== 10 || !/^[6-9]/.test(ten)) {
    throw new ValidationError('Enter a valid 10-digit Indian mobile number');
  }

  const { data: profiles, error } = await supabase
    .from('employee_profiles')
    .select('admin_user_id, status, personal_mobile, company_whatsapp, alternate_mobile')
    .eq('status', 'active')
    .not('admin_user_id', 'is', null);
  throwIfSupabaseError(error, 'Could not load employee profiles');

  const profile = (profiles ?? []).find((row) => profilePhoneMatches(row as Record<string, unknown>, ten));
  if (!profile?.admin_user_id) {
    throw new UnauthorizedError(
      'No staff account is linked to this mobile number. Ask your manager to add it in HR.'
    );
  }

  const { data: admin, error: adminErr } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', profile.admin_user_id)
    .maybeSingle();
  throwIfSupabaseError(adminErr, 'Could not load staff account');

  if (!admin?.active) throw new UnauthorizedError('Staff account is inactive');
  if (!admin.email_verified_at && admin.role !== 'super_admin') {
    throw new UnauthorizedError('Complete email verification using your invitation link');
  }

  return admin;
}

export const staffOtpService = {
  async sendOtp(phoneRaw: string, ipAddress?: string) {
    if (!isValidIndianPhone(phoneRaw)) {
      throw new ValidationError('Enter a valid 10-digit Indian mobile number');
    }
    const phone = normalizePhone(phoneRaw);

    await findActiveAdminByPhone(phoneRaw);

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from('staff_otp_challenges')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', since);
    throwIfSupabaseError(countErr, 'Could not check OTP rate limit');
    if ((count ?? 0) >= MAX_SEND_PER_HOUR) {
      throw new ValidationError('Too many OTP requests. Try again in an hour.');
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error } = await supabase.from('staff_otp_challenges').insert({
      phone,
      code_hash: hashOtp(code, phone),
      expires_at: expiresAt,
      ip_address: ipAddress ?? null,
    });
    throwIfSupabaseError(error, 'Could not create OTP challenge');

    try {
      const delivery = await deliverOtpWhatsApp(phone, code);
      return {
        sent: true,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        ...(!delivery.sent ? { devOtp: code } : {}),
      };
    } catch {
      throw new ValidationError('Could not send OTP. Please try again shortly.');
    }
  },

  async verifyOtp(phoneRaw: string, codeRaw: string) {
    if (!isValidIndianPhone(phoneRaw)) {
      throw new ValidationError('Enter a valid 10-digit Indian mobile number');
    }
    const phone = normalizePhone(phoneRaw);
    const code = String(codeRaw).replace(/\D/g, '');
    if (code.length !== 6) throw new ValidationError('Enter the 6-digit OTP');

    const admin = await findActiveAdminByPhone(phoneRaw);

    const { data: challenge, error } = await supabase
      .from('staff_otp_challenges')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load OTP challenge');

    if (!challenge) throw new UnauthorizedError('OTP expired or not sent. Request a new code.');
    if (new Date(String(challenge.expires_at)).getTime() < Date.now()) {
      throw new UnauthorizedError('OTP expired. Request a new code.');
    }
    if ((challenge.attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      throw new UnauthorizedError('Too many failed attempts. Request a new OTP.');
    }

    const valid = hashOtp(code, phone) === challenge.code_hash;
    await supabase
      .from('staff_otp_challenges')
      .update({ attempts: (challenge.attempts ?? 0) + 1 })
      .eq('id', challenge.id);

    if (!valid) throw new UnauthorizedError('Invalid OTP');

    const now = new Date().toISOString();
    await supabase.from('admin_users').update({ last_login_at: now, updated_at: now }).eq('id', admin.id);

    const email = String(admin.email ?? '');
    const token = createAdminToken(String(admin.id), email, String(admin.role));
    const profile = await adminAuthService.me(String(admin.id));

    return { token, admin: profile };
  },
};
