import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { normalizePhone } from '../../lib/phone.js';
import { languageTemplateResolverService } from '../admin/language-template-resolver.service.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
function otpMessage(code) {
    return `Your Morbeez login OTP is ${code}. Valid for 10 minutes. Do not share this code.`;
}
function shouldSendRealWhatsApp() {
    return env.NODE_ENV === 'production' || env.OTP_SEND_VIA_WHATSAPP;
}
function otpTemplateLanguages() {
    const langs = [
        env.WHATSAPP_OTP_TEMPLATE_LANGUAGE?.trim(),
        env.ADS_GYANI_TEMPLATE_LANGUAGE?.trim(),
        'en',
        'en_US',
    ].filter(Boolean);
    return [...new Set(langs)];
}
async function resolveOtpTemplateNames() {
    let dbName = null;
    try {
        dbName = await languageTemplateResolverService.getMetaTemplateName('login_otp');
    }
    catch (err) {
        logger.warn({ err }, 'Could not resolve login_otp template from DB');
    }
    const names = [
        dbName,
        env.WHATSAPP_OTP_TEMPLATE?.trim(),
        env.WHATSAPP_OUTBOUND_TEMPLATE?.trim(),
    ].filter(Boolean);
    return [...new Set(names)];
}
/** Meta/Ads Gyani OTP templates vary — try body var, copy_code button, or both. */
async function sendOtpTemplate(provider, to, templateName, code, language) {
    const attempts = [
        { body: [code], copyCode: code, language },
        { body: [code], language },
        { body: [], copyCode: code, language },
    ];
    let lastErr;
    for (const params of attempts) {
        try {
            await provider.sendTemplate(to, templateName, params);
            return;
        }
        catch (err) {
            lastErr = err;
        }
    }
    throw lastErr ?? new AppError('OTP template send failed', 502, 'OTP_TEMPLATE_FAILED');
}
/** Deliver OTP via WhatsApp. Returns whether a real message was sent (false = dev fallback only). */
export async function deliverOtpWhatsApp(phoneRaw, code) {
    if (!shouldSendRealWhatsApp()) {
        logger.info({ phone: normalizePhone(phoneRaw), code }, 'OTP (dev mode — not sent via WhatsApp)');
        return { sent: false };
    }
    const to = normalizePhone(phoneRaw);
    const provider = whatsappService.getProvider();
    const templateNames = await resolveOtpTemplateNames();
    const languages = otpTemplateLanguages();
    const errors = [];
    for (const templateName of templateNames) {
        for (const language of languages) {
            try {
                await sendOtpTemplate(provider, to, templateName, code, language);
                logger.info({ phone: to.replace(/\d(?=\d{4})/g, '*'), templateName, language }, 'OTP sent via WhatsApp template');
                return { sent: true };
            }
            catch (err) {
                logger.warn({ err, phone: to, templateName, language }, 'OTP template attempt failed');
                errors.push(err);
            }
        }
    }
    try {
        await whatsappService.sendText(to, otpMessage(code));
        logger.info({ phone: to.replace(/\d(?=\d{4})/g, '*') }, 'OTP sent via WhatsApp text (session window)');
        return { sent: true };
    }
    catch (err) {
        logger.error({ err, phone: to, priorErrors: errors }, 'OTP WhatsApp send failed');
        throw err;
    }
}
export function otpDeliveryErrorMessage(err) {
    if (err instanceof AppError) {
        if (err.code === 'ADS_GYANI_NOT_CONFIGURED' || err.code === 'WHATSAPP_NOT_CONFIGURED') {
            return 'WhatsApp OTP is not configured on the server. Please contact support.';
        }
        if (err.code === 'ADS_GYANI_SEND_FAILED' || err.code === 'WHATSAPP_TEMPLATE_FAILED') {
            return 'Could not deliver OTP on WhatsApp. Check that your number has WhatsApp, or try again shortly.';
        }
    }
    return 'Could not send OTP. Please try again shortly.';
}
//# sourceMappingURL=otp-whatsapp.service.js.map