import type { TemplateSendParams } from '../whatsapp-outbound.types.js';
export declare const adsgyaniWhatsAppProvider: {
    sendText(to: string, text: string): Promise<void>;
    sendTemplate(to: string, templateName: string, params: TemplateSendParams): Promise<void>;
};
//# sourceMappingURL=adsgyani.provider.d.ts.map