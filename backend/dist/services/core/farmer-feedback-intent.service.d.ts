/** Detect farmer disagreement / correction intent (multilingual keywords). */
export declare function isFarmerDisagreementIntent(text: string): boolean;
/**
 * Returns the first detected issue (chip / single-line flows). Use extractAllSuggestedDiagnoses for storage.
 */
export declare function extractSuggestedDiagnosis(text: string): string | null;
/** Each distinct issue from farmer free text — never one combined string. */
export declare function extractAllSuggestedDiagnoses(text: string): string[];
export declare function extractPriorProduct(text: string): string | null;
export declare function looksLikePriorExperience(text: string): boolean;
//# sourceMappingURL=farmer-feedback-intent.service.d.ts.map