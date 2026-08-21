export type QualifiedCaseRule = {
    requireFarmerVerified: boolean;
    requireCrop: boolean;
    requireCropStage: boolean;
    requireProblem: boolean;
    requireDiagnosis: boolean;
    requireRecommendation: boolean;
    requireEvidence: boolean;
};
export declare const DEFAULT_QUALIFIED_CASE_RULE: QualifiedCaseRule;
export type QualifiedCaseFacts = {
    farmerVerified: boolean;
    cropRecorded: boolean;
    cropStageRecorded: boolean;
    problemRecorded: boolean;
    diagnosisRecorded: boolean;
    recommendationRecorded: boolean;
    evidenceComplete: boolean;
};
export declare function present(value: unknown): boolean;
/** A case record existing is not enough — every required gate must pass. */
export declare function evaluateQualifiedCase(facts: QualifiedCaseFacts, rule?: QualifiedCaseRule): {
    qualified: boolean;
    reasons: string[];
};
//# sourceMappingURL=qualified-case.d.ts.map