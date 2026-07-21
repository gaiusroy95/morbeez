import { type FarmActivityAssistantClarification, type FarmActivityAssistantDraftV1, type FarmActivityAssistantSource, type FarmActivityAssistantSourceMedia, type FarmActivityAssistantSubEvent, type FarmActivityAssistantTranscriptSegment } from '@morbeez/shared/farm-activity-assistant';
type ExtractionPayload = {
    subEvents: FarmActivityAssistantSubEvent[];
    clarifications: FarmActivityAssistantClarification[];
};
export declare const FARM_ACTIVITY_EXTRACTION_SCHEMA: {
    type: string;
    additionalProperties: boolean;
    properties: Record<string, unknown>;
    required: string[];
};
/** Drops exact duplicate newly extracted events while keeping independent clear ones. */
export declare function dedupeIndependentSubEvents(events: FarmActivityAssistantSubEvent[]): FarmActivityAssistantSubEvent[];
export declare function validateFarmActivityExtraction(value: unknown, context: {
    sourceRefs: Set<string>;
    blockRefs: Set<string>;
    clarificationAttempts: number;
}): {
    ok: true;
    value: ExtractionPayload;
} | {
    ok: false;
    errors: string[];
};
export type FarmActivityExtractionInput = {
    farmerId: string;
    blockId?: string;
    messageId: string;
    channel: FarmActivityAssistantSource['channel'];
    text?: string;
    transcript?: FarmActivityAssistantTranscriptSegment[];
    media?: FarmActivityAssistantSourceMedia[];
    season?: string | null;
    existingDraft?: FarmActivityAssistantDraftV1;
    clarificationAttempts?: number;
    conversationSessionId?: string | null;
    persist?: boolean;
};
export declare const farmActivityExtractionService: {
    extract(input: FarmActivityExtractionInput): Promise<FarmActivityAssistantDraftV1>;
};
export {};
//# sourceMappingURL=farm-activity-extraction.service.d.ts.map