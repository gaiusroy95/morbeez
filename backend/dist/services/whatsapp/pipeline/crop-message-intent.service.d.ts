import type { AdvisoryLanguage } from '../../ai/types.js';
/**
 * True when the message is likely a crop-health / farming question (any supported language).
 */
export declare function isAgricultureMessage(text: string): boolean;
/**
 * Route to Crop Doctor text diagnosis (same bar for English, Hindi, Malayalam, etc.).
 */
export declare function shouldRunCropDoctorTextDiagnosis(text: string): boolean;
/** Stable cross-language intent slug for reuse indexing / lookup. */
export declare function buildCrossLanguageIntentSlug(cropType: string, text: string, issueLabel?: string | null): string | null;
export declare function pickLocalizedFarmerSummary(advisory: {
    probableIssue?: string;
    farmerSummaryEn?: string;
    farmerSummaryMl?: string;
}, language: AdvisoryLanguage): string;
//# sourceMappingURL=crop-message-intent.service.d.ts.map