export type KpiUnit = 'pct' | 'inr' | 'count';
export type KpiParameter = {
    key: string;
    label: string;
    weightPct: number;
    target: number;
    unit: KpiUnit;
};
export type KpiParameterScore = KpiParameter & {
    actual: number;
    score: number;
    weighted: number;
};
export declare const DEFAULT_PARTNER_KPI_WEIGHTS: KpiParameter[];
export declare const DEFAULT_AGRONOMIST_KPI_WEIGHTS: KpiParameter[];
export declare function clampScore(n: number): number;
/** Achievement vs target, capped at 100. Percent parameters already live on 0–100. */
export declare function parameterScore(actual: number, target: number): number;
export declare function validateWeights(parameters: KpiParameter[]): void;
export declare function scoreWeightedKpi(parameters: KpiParameter[], actuals: Record<string, number>): {
    total: number;
    lines: KpiParameterScore[];
};
//# sourceMappingURL=weighted-kpi.d.ts.map