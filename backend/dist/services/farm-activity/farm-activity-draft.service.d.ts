import { type FarmActivityAssistantDraftV1 } from '@morbeez/shared/farm-activity-assistant';
export type FarmActivityDraftStatus = 'open' | 'clarifying' | 'awaiting_confirm' | 'confirmed' | 'cancelled' | 'expired' | 'superseded';
export type FarmActivityDraftRow = {
    id: string;
    farmer_id: string;
    conversation_session_id: string | null;
    channel: string;
    status: FarmActivityDraftStatus;
    revision: number;
    contract_version: string;
    draft_json: FarmActivityAssistantDraftV1;
    field_confidence: Record<string, unknown>;
    unresolved_fields: unknown[];
    source_message_ids: string[];
    source_provider: string;
    primary_message_id: string | null;
    transcript: string | null;
    detected_language: string | null;
    preferred_language_hint: string | null;
    input_modalities: string[];
    metadata: Record<string, unknown>;
};
export declare function summarizeDraftFieldConfidence(draft: FarmActivityAssistantDraftV1): {
    fieldConfidence: Record<string, unknown>;
    unresolvedFields: unknown[];
};
export declare function resolveDraftStatus(draft: FarmActivityAssistantDraftV1): FarmActivityDraftStatus;
export declare const farmActivityDraftService: {
    schemaAvailable: boolean | null;
    isSchemaAvailable(): Promise<boolean>;
    getById(draftId: string): Promise<FarmActivityDraftRow | null>;
    getActiveForFarmer(farmerId: string, channel?: string): Promise<FarmActivityDraftRow | null>;
    persistExtraction(input: {
        farmerId: string;
        conversationSessionId?: string | null;
        preferredLanguageHint?: string | null;
        detectedLanguage: string;
        codeMixed: boolean;
        clarificationAttempts: number;
        draft: FarmActivityAssistantDraftV1;
        transcript?: string | null;
    }): Promise<FarmActivityDraftRow | null>;
    appendEvent(input: {
        draftId: string;
        eventType: string;
        revision: number;
        actor: string;
        payload?: Record<string, unknown>;
        sourceMessageId?: string | null;
    }): Promise<void>;
    markCancelled(input: {
        draftId: string;
        revision: number;
        reason?: string;
        actor?: string;
    }): Promise<FarmActivityDraftRow | null>;
    markConfirmed(input: {
        draftId: string;
        revision: number;
        commandId: string;
        activityIds: string[];
        roiEntryIds: string[];
        harvestIds: string[];
        actor?: string;
    }): Promise<FarmActivityDraftRow | null>;
};
//# sourceMappingURL=farm-activity-draft.service.d.ts.map