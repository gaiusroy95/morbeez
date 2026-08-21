export type KpiFactorBand = {
    maxExclusive: number;
    factor: number;
};
export declare const DEFAULT_KPI_FACTOR_BANDS: KpiFactorBand[];
/** Partner KPI score 0–100 → incentive factor. Bands come from the active rule version. */
export declare function partnerKpiFactor(score: number, bands?: KpiFactorBand[]): number;
export type AgronomistSlab = {
    maxExclusive: number | null;
    unlockPct: number;
};
export declare const DEFAULT_AGRONOMIST_SLABS: AgronomistSlab[];
/** Monthly attributed eligible sales → unlock % of agronomist Channel Pool. */
export declare function agronomistUnlockPct(monthlyEligibleSalesInr: number, slabs?: AgronomistSlab[]): number;
export declare function round2(n: number): number;
export declare function partnerIncentiveInr(input: {
    eligibleItemInr: number;
    partnerPoolPct: number;
    kpiFactor: number;
}): number;
export declare function agronomistPoolInr(input: {
    eligibleItemInr: number;
    agronomistPoolPct: number;
}): number;
export declare function agronomistSalesIncentiveInr(poolInr: number, unlockPct: number): number;
//# sourceMappingURL=kpi-factor.d.ts.map