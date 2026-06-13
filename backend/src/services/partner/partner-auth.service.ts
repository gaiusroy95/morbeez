import { createHash, randomInt } from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { isValidIndianPhone, normalizePhone } from '../../lib/phone.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { createPartnerToken } from '../../lib/partner-jwt.js';
import { deliverOtpWhatsApp, otpDeliveryErrorMessage } from '../auth/otp-whatsapp.service.js';
import { partnerService } from './partner.service.js';
import { logger } from '../../lib/logger.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_SEND_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(code: string, phone: string): string {
  return createHash('sha256').update(`partner:${phone}:${code}:${env.FARMER_JWT_SECRET}`).digest('hex');
}

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export const partnerAuthService = {
  async sendOtp(phoneRaw: string, ipAddress?: string) {
    if (!isValidIndianPhone(phoneRaw)) {
      throw new ValidationError('Enter a valid 10-digit Indian mobile number');
    }
    const phone = normalizePhone(phoneRaw);

    const { data: partner } = await supabase
      .from('partners')
      .select('id, status')
      .eq('phone', phone)
      .maybeSingle();

    if (!partner) throw new ValidationError('No partner account found for this number');
    if (!['active', 'certified', 'training'].includes(String(partner.status))) {
      throw new ValidationError('Partner account is not active yet');
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from('partner_otp_challenges')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', since);
    throwIfSupabaseError(countErr, 'Could not check OTP rate limit');
    if ((count ?? 0) >= MAX_SEND_PER_HOUR) {
      throw new ValidationError('Too many OTP requests. Try again in an hour.');
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error } = await supabase.from('partner_otp_challenges').insert({
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
    } catch (err) {
      logger.error({ err, phone }, 'Partner OTP WhatsApp send failed');
      throw new ValidationError(otpDeliveryErrorMessage(err));
    }
  },

  async verifyOtp(phoneRaw: string, codeRaw: string) {
    if (!isValidIndianPhone(phoneRaw)) {
      throw new ValidationError('Enter a valid 10-digit Indian mobile number');
    }
    const phone = normalizePhone(phoneRaw);
    const code = String(codeRaw).replace(/\D/g, '');
    if (code.length !== 6) throw new ValidationError('Enter the 6-digit OTP');

    const { data: challenge, error } = await supabase
      .from('partner_otp_challenges')
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
      .from('partner_otp_challenges')
      .update({ attempts: (challenge.attempts ?? 0) + 1 })
      .eq('id', challenge.id);

    if (!valid) throw new UnauthorizedError('Invalid OTP');

    const profile = await partnerService.getByPhone(phone);
    if (!profile) throw new UnauthorizedError('Partner account not found');

    const token = createPartnerToken(profile.id, phone);
    return { token, partner: profile };
  },

  async loginWithPassword(phoneRaw: string, password: string) {
    if (!isValidIndianPhone(phoneRaw)) {
      throw new ValidationError('Enter a valid 10-digit Indian mobile number');
    }
    const phone = normalizePhone(phoneRaw);

    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load partner account');
    if (!data?.password_hash) throw new UnauthorizedError('Invalid credentials');
    if (!verifyPassword(password, String(data.password_hash))) {
      throw new UnauthorizedError('Invalid credentials');
    }
    if (!['active', 'certified', 'training'].includes(String(data.status))) {
      throw new UnauthorizedError('Partner account is not active');
    }

    const profile = partnerService.mapRow(data);
    const token = createPartnerToken(profile.id, phone);
    return { token, partner: profile };
  },

  async setPassword(partnerId: string, password: string) {
    if (password.length < 8) throw new ValidationError('Password must be at least 8 characters');
    const { error } = await supabase
      .from('partners')
      .update({ password_hash: hashPassword(password), updated_at: new Date().toISOString() })
      .eq('id', partnerId);
    throwIfSupabaseError(error, 'Could not set password');
    return { ok: true as const };
  },
};
