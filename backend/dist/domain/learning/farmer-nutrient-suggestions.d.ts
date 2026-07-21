/** Structured farmer suggestions for the diagnosis learning loop (nutrient disputes). */
export declare const FARMER_NUTRIENT_SUGGESTIONS: readonly [{
    readonly id: "iron";
    readonly buttonId: "feedback.suggest.iron";
    readonly label: "Iron (Fe) deficiency";
    readonly diagnosis: "Iron (Fe) deficiency";
}, {
    readonly id: "zinc";
    readonly buttonId: "feedback.suggest.zinc";
    readonly label: "Zinc (Zn) deficiency";
    readonly diagnosis: "Zinc (Zn) deficiency";
}, {
    readonly id: "magnesium";
    readonly buttonId: "feedback.suggest.magnesium";
    readonly label: "Magnesium (Mg) deficiency";
    readonly diagnosis: "Magnesium (Mg) deficiency";
}, {
    readonly id: "nitrogen";
    readonly buttonId: "feedback.suggest.nitrogen";
    readonly label: "Nitrogen (N) deficiency";
    readonly diagnosis: "Nitrogen (N) deficiency";
}];
export type FarmerNutrientSuggestionId = (typeof FARMER_NUTRIENT_SUGGESTIONS)[number]['id'];
export declare const FARMER_SUGGEST_OTHER_BUTTON_ID = "feedback.suggest.other";
/** True when farmer typed a free answer (not a WhatsApp suggestion chip / button id). */
export declare function looksLikeDescriptiveHypothesis(raw: string): boolean;
/** All nutrient deficiency labels mentioned in free text (order preserved). */
export declare function extractAllFarmerNutrientLabels(raw: string): string[];
/**
 * Extract each distinct issue the farmer named — never one combined diagnosis string.
 * Example input → ["Iron (Fe) deficiency", "Zinc (Zn) deficiency", "Magnesium (Mg) deficiency", ...]
 */
export declare function extractAllFarmerSuggestedDiagnoses(raw: string): string[];
/**
 * @deprecated Display-only summary. Prefer extractAllFarmerSuggestedDiagnoses for storage.
 */
export declare function summarizeFarmerNutrientSuggestion(raw: string): string | null;
/** Returns diagnosis if nutrient match; null if "other"; undefined if not a suggestion input. */
export declare function mapFarmerSuggestionInput(raw: string): string | null | undefined;
export declare function isFarmerSuggestionButtonId(raw: string): boolean;
/** Read structured diagnoses from feedback row (metadata array or re-parse legacy text). */
export declare function getFarmerSuggestedDiagnosesFromStored(params: {
    farmer_suggested_diagnosis?: string | null;
    farmer_prior_experience?: string | null;
    metadata?: Record<string, unknown> | null;
}): string[];
//# sourceMappingURL=farmer-nutrient-suggestions.d.ts.map