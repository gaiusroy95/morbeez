import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { normalizePhone } from '../../lib/phone.js';
import { languageTemplateResolverService } from '../admin/language-template-resolver.service.js';
import { whatsappSessionService } from './whatsapp-session.service.js';
export const whatsappOutboundService = {
    async sendToFarmer(provider, params) {
        const to = normalizePhone(params.phone);
        const inSession = await whatsappSessionService.hasActiveInboundSession(params.farmerId);
        if (!params.forceTemplate && inSession) {
            if (params.templateKey) {
                const dbBody = await languageTemplateResolverService.getApprovedBody(params.templateKey, params.language ?? 'en', params.templateVariables);
                if (dbBody) {
                    await provider.sendText(to, dbBody);
                    return { mode: 'session' };
                }
            }
            await provider.sendText(to, params.text);
            return { mode: 'session' };
        }
        const dbMeta = params.templateKey
            ? await languageTemplateResolverService.getMetaTemplateName(params.templateKey)
            : null;
        const templateName = params.templateName?.trim() ||
            dbMeta ||
            env.WHATSAPP_OUTBOUND_TEMPLATE?.trim() ||
            env.WHATSAPP_WELCOME_TEMPLATE?.trim();
        if (!templateName) {
            throw new AppError('Farmer is outside the 24-hour WhatsApp window. Set WHATSAPP_OUTBOUND_TEMPLATE in .env.', 400, 'WHATSAPP_TEMPLATE_REQUIRED');
        }
        const fields = params.templateBodyFields?.length
            ? params.templateBodyFields
            : [params.text.slice(0, 200)];
        await provider.sendTemplate(to, templateName, { body: fields });
        return { mode: 'template' };
    },
    async sendWelcomeTemplate(provider, params) {
        const dbMeta = await languageTemplateResolverService.getMetaTemplateName('welcome_farmer');
        const template = dbMeta || env.WHATSAPP_WELCOME_TEMPLATE?.trim();
        if (!template)
            return false;
        const should = await whatsappSessionService.shouldSendWelcomeTemplate(params.farmerId);
        if (!should)
            return false;
        const to = normalizePhone(params.phone);
        const name = params.profileName?.split(' ')[0] ?? 'Farmer';
        const dbBody = await languageTemplateResolverService.getApprovedBody('welcome_farmer', params.language ?? 'en', { FarmerName: name, name });
        if (dbBody && (await whatsappSessionService.hasActiveInboundSession(params.farmerId))) {
            await provider.sendText(to, dbBody);
            await whatsappSessionService.markWelcomeTemplateSent(params.farmerId);
            return true;
        }
        await provider.sendTemplate(to, template, {
            body: [name],
        });
        await whatsappSessionService.markWelcomeTemplateSent(params.farmerId);
        return true;
    },
};
//# sourceMappingURL=whatsapp-outbound.service.js.map