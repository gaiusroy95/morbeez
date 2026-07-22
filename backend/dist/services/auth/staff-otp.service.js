import { createHash, randomInt } from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { isValidIndianPhone, normalizePhone } from '../../lib/phone.js';
import { createAdminToken } from '../../lib/admin-jwt.js';
import { adminAuthService } from './admin-auth.service.js';
import { deliverOtpWhatsApp, otpDeliveryErrorMessage } from './otp-whatsapp.service.js';
import { findActiveAdminByPhone } from './staff-phone-lookup.js';
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_SEND_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;
function hashOtp(code, phone) {
    return createHash('sha256').update(`${phone}:${code}:${env.ADMIN_JWT_SECRET}`).digest('hex');
}
function generateOtp() {
    return String(randomInt(100000, 999999));
}
export const staffOtpService = {
    async sendOtp(phoneRaw, ipAddress) {
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
        }
        catch (err) {
            throw new ValidationError(otpDeliveryErrorMessage(err));
        }
    },
    async verifyOtp(phoneRaw, codeRaw) {
        if (!isValidIndianPhone(phoneRaw)) {
            throw new ValidationError('Enter a valid 10-digit Indian mobile number');
        }
        const phone = normalizePhone(phoneRaw);
        const code = String(codeRaw).replace(/\D/g, '');
        if (code.length !== 6)
            throw new ValidationError('Enter the 6-digit OTP');
        const admin = await findActiveAdminByPhone(phoneRaw);
        const { data: challenge, error } = await supabase
            .from('staff_otp_challenges')
            .select('*')
            .eq('phone', phone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load OTP challenge');
        if (!challenge)
            throw new UnauthorizedError('OTP expired or not sent. Request a new code.');
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
        if (!valid)
            throw new UnauthorizedError('Invalid OTP');
        const now = new Date().toISOString();
        await supabase.from('admin_users').update({ last_login_at: now, updated_at: now }).eq('id', admin.id);
        const email = String(admin.email ?? '');
        const token = createAdminToken(String(admin.id), email, String(admin.role));
        const profile = await adminAuthService.me(String(admin.id));
        return { token, admin: profile };
    },
};
//# sourceMappingURL=staff-otp.service.js.map