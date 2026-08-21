export const DEFAULT_KPI_FACTOR_BANDS = [
    { maxExclusive: 60, factor: 0.7 },
    { maxExclusive: 70, factor: 0.8 },
    { maxExclusive: 80, factor: 0.9 },
    { maxExclusive: 90, factor: 0.95 },
    { maxExclusive: 101, factor: 1 },
];
/** Partner KPI score 0–100 → incentive factor. Bands come from the active rule version. */
export function partnerKpiFactor(score, bands = DEFAULT_KPI_FACTOR_BANDS) {
    const n = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
    const sorted = [...bands].sort((a, b) => a.maxExclusive - b.maxExclusive);
    for (const band of sorted) {
        if (n < band.maxExclusive)
            return band.factor;
    }
    return sorted[sorted.length - 1]?.factor ?? 1;
}
export const DEFAULT_AGRONOMIST_SLABS = [
    { maxExclusive: 300_000, unlockPct: 0 },
    { maxExclusive: 500_000, unlockPct: 50 },
    { maxExclusive: 800_000, unlockPct: 75 },
    { maxExclusive: null, unlockPct: 100 },
];
/** Monthly attributed eligible sales → unlock % of agronomist Channel Pool. */
export function agronomistUnlockPct(monthlyEligibleSalesInr, slabs = DEFAULT_AGRONOMIST_SLABS) {
    const sales = Math.max(0, Number(monthlyEligibleSalesInr) || 0);
    const sorted = [...slabs].sort((a, b) => {
        if (a.maxExclusive == null)
            return 1;
        if (b.maxExclusive == null)
            return -1;
        return a.maxExclusive - b.maxExclusive;
    });
    for (const slab of sorted) {
        if (slab.maxExclusive == null || sales < slab.maxExclusive)
            return slab.unlockPct;
    }
    return 0;
}
export function round2(n) {
    return Math.round(n * 100) / 100;
}
export function partnerIncentiveInr(input) {
    return round2(Math.max(0, input.eligibleItemInr) * (Math.max(0, input.partnerPoolPct) / 100) * Math.max(0, input.kpiFactor));
}
export function agronomistPoolInr(input) {
    return round2(Math.max(0, input.eligibleItemInr) * (Math.max(0, input.agronomistPoolPct) / 100));
}
export function agronomistSalesIncentiveInr(poolInr, unlockPct) {
    return round2(Math.max(0, poolInr) * (Math.max(0, unlockPct) / 100));
}
//# sourceMappingURL=kpi-factor.js.map