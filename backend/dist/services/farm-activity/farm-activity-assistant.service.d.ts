import { type FarmActivityAssistantDraftV1 } from '@morbeez/shared/farm-activity-assistant';
import type { AdvisoryLanguage } from '../ai/types.js';
import type { InvoiceEvidenceExtractOk } from './farm-activity-invoice-evidence.service.js';
export type FarmActivitySenders = {
    text: (phone: string, text: string) => Promise<void>;
    buttons?: (params: {
        phone: string;
        body: string;
        buttons: Array<{
            id: string;
            title: string;
        }>;
    }) => Promise<void>;
};
export declare const farmActivityAssistantService: {
    enabled(): boolean;
    voiceEnabled(): boolean;
    looksLikeIntent(text: string): boolean;
    isFarmActivityState(state: string): boolean;
    isActionButton(text: string): boolean;
    tryHandleInbound(input: {
        farmerId: string;
        phone: string;
        language: AdvisoryLanguage;
        text: string;
        messageId: string;
        sessionState: string;
        send: FarmActivitySenders;
        modality?: "text" | "voice";
        transcript?: string | null;
        conversationSessionId?: string | null;
        blockId?: string | null;
    }): Promise<boolean>;
    processUtterance(input: {
        farmerId: string;
        phone: string;
        language: AdvisoryLanguage;
        text: string;
        messageId: string;
        send: FarmActivitySenders;
        modality: "text" | "voice";
        transcript?: string | null;
        conversationSessionId?: string | null;
        blockId?: string | null;
        sessionState?: string;
    }): Promise<boolean>;
    sendConfirmPrompt(input: {
        phone: string;
        language: AdvisoryLanguage;
        draft: FarmActivityAssistantDraftV1;
        send: FarmActivitySenders;
    }): Promise<void>;
    presentInvoiceDraft(input: {
        farmerId: string;
        phone: string;
        language: AdvisoryLanguage;
        send: FarmActivitySenders;
        invoice: InvoiceEvidenceExtractOk;
        conversationSessionId?: string | null;
        clarificationAttempts?: number;
    }): Promise<boolean>;
    handleAction(input: {
        farmerId: string;
        phone: string;
        language: AdvisoryLanguage;
        text: string;
        send: FarmActivitySenders;
        blockId?: string | null;
    }): Promise<boolean>;
};
//# sourceMappingURL=farm-activity-assistant.service.d.ts.map