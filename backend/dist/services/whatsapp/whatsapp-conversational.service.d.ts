import type { AdvisoryLanguage } from '../ai/types.js';
import type { FarmerMemorySnapshot } from './pipeline/farmer-memory.service.js';
/**
 * Lightweight OpenAI chat reply for WhatsApp (greetings, general chat).
 * Full crop diagnosis still uses cropDoctorService when symptoms/media warrant it.
 */
export declare const whatsappConversationalService: {
    isEnabled(): boolean;
    generateReply(params: {
        farmerId: string;
        userMessage: string;
        language: AdvisoryLanguage;
        farmerName?: string;
        /** @deprecated use memory */
        conversationHistory?: string[];
        memory?: FarmerMemorySnapshot;
        /** Farmer is asking to deepen the previous assistant message — never reset to welcome */
        followUp?: boolean;
    }): Promise<string>;
};
//# sourceMappingURL=whatsapp-conversational.service.d.ts.map