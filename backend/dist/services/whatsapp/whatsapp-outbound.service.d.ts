import type { TemplateSendParams } from './whatsapp-outbound.types.js';
type SendProvider = {
    sendText: (to: string, text: string) => Promise<void>;
    sendTemplate: (to: string, name: string, params: TemplateSendParams) => Promise<void>;
};
export declare const whatsappOutboundService: {
    sendToFarmer(provider: SendProvider, params: {
        phone: string;
        farmerId: string;
        text: string;
        forceTemplate?: boolean;
        templateName?: string;
        templateBodyFields?: string[];
        templateKey?: string;
        language?: string;
        templateVariables?: Record<string, string>;
    }): Promise<{
        mode: "session" | "template";
    }>;
    sendWelcomeTemplate(provider: SendProvider, params: {
        phone: string;
        farmerId: string;
        profileName?: string;
        language?: string;
    }): Promise<boolean>;
};
export {};
//# sourceMappingURL=whatsapp-outbound.service.d.ts.map