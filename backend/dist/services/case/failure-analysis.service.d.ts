export type FailureType = 'ai_failure' | 'agronomist_failure' | 'farmer_failure' | 'product_failure';
export declare const failureAnalysisService: {
    classify(params: {
        outcomeStatus?: "improved" | "same" | "worse";
        agronomistCorrected?: boolean;
        applicationLogged?: boolean;
        fusedConfidence?: number;
    }): FailureType | null;
};
//# sourceMappingURL=failure-analysis.service.d.ts.map