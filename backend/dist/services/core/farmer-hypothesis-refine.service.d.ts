import type { AdvisoryLanguage } from '../ai/types.js';
export type RefinedConditionRole = 'primary' | 'contributing' | 'secondary' | 'possible';
export type RefinedCondition = {
    label: string;
    /** 0–1 mid-point used for ranking / storage */
    probability: number;
    /** Optional calibrated band ends from the model (preferred for display) */
    probabilityLow?: number;
    probabilityHigh?: number;
    likelihood?: 'high' | 'moderate' | 'possible' | 'unlikely';
    role: RefinedConditionRole;
    reason: string;
};
export type FarmerHypothesisRefineResult = {
    conditions: RefinedCondition[];
    sequenceSummary: string;
    replyToFarmer: string;
    source: 'llm_vision' | 'llm_text';
    usedPhoto: boolean;
};
/** Free-typed theory (not a WhatsApp chip / button id). */
export declare function looksLikeDescriptiveHypothesis(raw: string): boolean;
export declare const farmerHypothesisRefineService: {
    looksLikeDescriptiveHypothesis: typeof looksLikeDescriptiveHypothesis;
    refine(params: {
        farmerText: string;
        sessionId: string | null;
        farmerId?: string | null;
        lang: AdvisoryLanguage;
        priorAiIssue?: string | null;
    }): Promise<FarmerHypothesisRefineResult>;
};
//# sourceMappingURL=farmer-hypothesis-refine.service.d.ts.map