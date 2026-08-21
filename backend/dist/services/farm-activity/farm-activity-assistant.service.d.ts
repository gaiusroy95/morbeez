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
/** Omit empty / unresolved placeholders so WhatsApp never shows `| — | block —`. */
declare function draftParts(...parts: Array<string | null | undefined>): string;
declare function summarizeDraft(draft: FarmActivityAssistantDraftV1, lang: AdvisoryLanguage): string;
/** Exported for unit tests. */
export declare const farmActivityDraftSummaryForTest: {
    summarizeDraft: typeof summarizeDraft;
    draftParts: typeof draftParts;
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
        /** Crop Doctor feedback handoff — open a draft even if the global flag is off. */
        force?: boolean;
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
        force?: boolean;
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
export {};
//# sourceMappingURL=farm-activity-assistant.service.d.ts.map