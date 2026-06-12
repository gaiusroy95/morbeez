import type { TemplateSendParams } from '../whatsapp-outbound.types.js';
/**
 * Interakt WhatsApp BSP adapter
 * Docs: https://www.interakt.shop/resource-center/api-doc/
 */
export declare const interaktWhatsAppProvider: {
    sendText(to: string, text: string): Promise<void>;
    sendTemplate(to: string, templateName: string, params: TemplateSendParams): Promise<void>;
};
//# sourceMappingURL=interakt.provider.d.ts.map