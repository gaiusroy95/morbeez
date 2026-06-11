import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { normalizePhone } from '../../lib/phone.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
function otpMessage(code) {
    return `Your Morbeez login OTP is ${code}. Valid for 10 minutes. Do not share this code.`;
}
function shouldSendRealWhatsApp() {
    return env.NODE_ENV === 'production' || env.OTP_SEND_VIA_WHATSAPP;
}
/** Deliver OTP via WhatsApp. Returns whether a real message was sent (false = dev fallback only). */
export async function deliverOtpWhatsApp(phoneRaw, code) {
    if (!shouldSendRealWhatsApp()) {
        logger.info({ phone: normalizePhone(phoneRaw), code }, 'OTP (dev mode — not sent via WhatsApp)');
        return { sent: false };
    }
    const to = normalizePhone(phoneRaw);
    const otpTemplate = env.WHATSAPP_OTP_TEMPLATE?.trim();
    const fallbackTemplate = env.WHATSAPP_OUTBOUND_TEMPLATE?.trim();
    const provider = whatsappService.getProvider();
    if (otpTemplate) {
        await provider.sendTemplate(to, otpTemplate, { body: [code] });
        return { sent: true };
    }
    try {
        await whatsappService.sendText(to, otpMessage(code));
        return { sent: true };
    }
    catch (err) {
        if (fallbackTemplate) {
            logger.warn({ err, phone: to }, 'OTP sendText failed — retrying with outbound template');
            await provider.sendTemplate(to, fallbackTemplate, { body: [code, '10 minutes'] });
            return { sent: true };
        }
        logger.error({ err, phone: to }, 'OTP WhatsApp send failed');
        throw err;
    }
}
//# sourceMappingURL=otp-whatsapp.service.js.map