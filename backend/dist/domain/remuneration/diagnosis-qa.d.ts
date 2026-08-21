export type DiagnosisQaRule = {
    sampleRatePct: number;
    sampleCap: number;
};
export declare const DEFAULT_DIAGNOSIS_QA_RULE: DiagnosisQaRule;
/** MIN(rate% of qualified cases, cap). Never sample more than the qualified set. */
export declare function diagnosisQaSampleSize(qualifiedCount: number, rule?: DiagnosisQaRule): number;
export declare function diagnosisAccuracyPct(accurate: number, inaccurate: number): number;
/** Stable shuffle so the same month redraws the same sample unless ids change. */
export declare function pickSample<T>(items: T[], size: number, seed: string): T[];
//# sourceMappingURL=diagnosis-qa.d.ts.map