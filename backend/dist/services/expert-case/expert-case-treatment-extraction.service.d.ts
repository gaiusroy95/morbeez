import type { ExpertCaseReviewDraft, ExpertTreatmentActivity } from '@morbeez/shared/expert-case';
export declare function parseDilutionVolumeL(text: string): number | null;
export declare function detectTreatmentMethod(segment: string): string | null;
export declare function splitCompositeTreatmentMessage(text: string): string[];
export declare function parseTreatmentActivitiesFromMessage(message: string): ExpertTreatmentActivity[];
/** Merge LLM extraction with deterministic parsing from the latest agronomist message. */
export declare function supplementTreatmentDraft(draft: ExpertCaseReviewDraft, latestMessage: string): ExpertCaseReviewDraft;
//# sourceMappingURL=expert-case-treatment-extraction.service.d.ts.map