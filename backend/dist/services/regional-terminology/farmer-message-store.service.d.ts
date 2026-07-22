import type { AdvisoryLanguage } from '../ai/types.js';
/**
 * Stage 1 — persist raw farmer messages for terminology + learning audit.
 */
export declare const farmerMessageStoreService: {
    record(params: {
        farmerId: string;
        rawMessage: string;
        detectedLanguage: AdvisoryLanguage;
        channel?: string;
        messageType?: string;
        externalMessageId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<string | null>;
};
//# sourceMappingURL=farmer-message-store.service.d.ts.map