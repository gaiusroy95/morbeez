import type { TemplateSendParams } from '../whatsapp-outbound.types.js';
/**
 * WATI adapter — same interface as Cloud API for provider swap.
 * https://docs.wati.io/
 */
export declare const watiWhatsAppProvider: {
    sendText(to: string, text: string): Promise<void>;
    sendTemplate(to: string, templateName: string, params: TemplateSendParams): Promise<void>;
};
//# sourceMappingURL=wati.provider.d.ts.map