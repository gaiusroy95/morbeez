import { createHash, randomInt } from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { isValidIndianPhone, normalizePhone } from '../../lib/phone.js';
import { createFarmerToken } from '../../lib/jwt.js';
import { farmerAuthService } from './farmer-auth.service.js';
import { deliverOtpWhatsApp, otpDeliveryErrorMessage } from './otp-whatsapp.service.js';
import { leadService } from '../crm/lead.service.js';
import { partnerEnrollmentService } from '../partner/partner-enrollment.service.js';
import { farmerOwnershipService } from '../partner/farmer-ownership.service.js';
import { eventBus } from '../../events/bus.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_SEND_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(code: string, phone: string): string {
  return createHash('sha256').update(`${phone}:${code}:${env.FARMER_JWT_SECRET}`).digest('hex');
}

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

function tenDigitPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}

async function findFarmerByPhone(phone: string) {
  const ten = tenDigitPhone(phone);
  const { data: exact, error: exactErr } = await supabase
    .from('farmers')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  throwIfSupabaseError(exactErr, 'Could not load farmer account');
  if (exact) return exact;

  const { data: rows, error } = await supabase
    .from('farmers')
    .select('*')
    .or(`phone.eq.${ten},phone.eq.91${ten}`)
    .limit(1);
  throwIfSupabaseError(error, 'Could not load farmer account');
  return rows?.[0] ?? null;
}

export const farmerOtpService = {
  async sendOtp(phoneRaw: string, ipAddress?: string) {
    if (!isValidIndianPhone(phoneRaw)) {
      throw new ValidationError('Enter a valid 10-digit Indian mobile number');
    }
    const phone = normalizePhone(phoneRaw);

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from('farmer_otp_challenges')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', since);
    throwIfSupabaseError(countErr, 'Could not check OTP rate limit');
    if ((count ?? 0) >= MAX_SEND_PER_HOUR) {
      throw new ValidationError('Too many OTP requests. Try again in an hour.');
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error } = await supabase.from('farmer_otp_challenges').insert({
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
      logger.error({ err, phone }, 'OTP WhatsApp send failed');
      throw new ValidationError(otpDeliveryErrorMessage(err));
    }
  },

  async verifyOtp(
    phoneRaw: string,
    codeRaw: string,
    opts?: { partnerCode?: string; qrToken?: string }
  ) {
    if (!isValidIndianPhone(phoneRaw)) {
      throw new ValidationError('Enter a valid 10-digit Indian mobile number');
    }
    const phone = normalizePhone(phoneRaw);
    const code = String(codeRaw).replace(/\D/g, '');
    if (code.length !== 6) throw new ValidationError('Enter the 6-digit OTP');

    const { data: challenge, error } = await supabase
      .from('farmer_otp_challenges')
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
      .from('farmer_otp_challenges')
      .update({ attempts: (challenge.attempts ?? 0) + 1 })
      .eq('id', challenge.id);

    if (!valid) throw new UnauthorizedError('Invalid OTP');

    const now = new Date().toISOString();
    let farmerRow = await findFarmerByPhone(phone);
    const isNew = !farmerRow;

    if (!farmerRow) {
      const ten = tenDigitPhone(phone);
      const { data: created, error: createErr } = await supabase
        .from('farmers')
        .insert({
          phone: ten,
          name: `Farmer ${ten.slice(-4)}`,
          preferred_language: 'en',
          source: 'mobile',
          metadata: { signup_channel: 'mobile', whatsapp_opt_in: true },
          last_login_at: now,
          updated_at: now,
        })
        .select('*')
        .single();
      throwIfSupabaseError(createErr, 'Could not create farmer account');
      farmerRow = created;
    } else {
      await supabase
        .from('farmers')
        .update({ last_login_at: now, updated_at: now })
        .eq('id', farmerRow.id);
    }

    const farmerId = String(farmerRow.id);
    if (isNew || !(farmerRow as Record<string, unknown>).enrollment_owner_type) {
      try {
        await leadService.upsertSignupLead({
          farmerId,
          phone,
          name: farmerRow.name ? String(farmerRow.name) : undefined,
          channel: 'mobile',
          partnerCode: opts?.partnerCode ?? null,
        });
      } catch (err) {
        logger.error({ err, farmerId }, 'Mobile OTP lead upsert failed');
      }

      try {
        const partnerEnroll = await partnerEnrollmentService.enrollFarmerWithPartner({
          farmerId,
          phone,
          name: farmerRow.name ? String(farmerRow.name) : undefined,
          partnerCode: opts?.partnerCode,
          qrToken: opts?.qrToken,
          enrollmentSource: opts?.qrToken ? 'partner_qr' : 'mobile_app',
        });
        if (!partnerEnroll.enrolled) {
          await farmerOwnershipService.setEnrollmentOwnership({
            farmerId,
            enrollmentOwnerType: 'morbeez',
            enrollmentSource: 'mobile_app',
            serviceModel: 'remote_advisory',
            customerOwnerType: 'morbeez',
          });
        }
      } catch (err) {
        logger.error({ err, farmerId }, 'Mobile OTP ownership failed');
      }

      try {
        await eventBus.publish(
          'lead.created',
          { farmerId, source: 'mobile', intent: 'general', assignedTo: null },
          'farmer-otp'
        );
      } catch {
        /* non-blocking */
      }
    }

    const email = farmerRow.email ? String(farmerRow.email) : `mobile+${tenDigitPhone(phone)}@morbeez.in`;
    const token = createFarmerToken(String(farmerRow.id), email);
    const profile = await farmerAuthService.me(String(farmerRow.id));

    return { token, farmer: profile };
  },
};
