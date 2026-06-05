import type { PricingEngineConfig } from './pricing-config.service.js';
export type RetailOrBulk = 'retail' | 'bulk';
export declare function classifyOrderType(orderTotalInr: number, config: PricingEngineConfig): RetailOrBulk;
/** Monthly target achievement → base incentive % */
export declare function baseIncentivePct(achievementPct: number, config: PricingEngineConfig): number;
/** Avg realization % → multiplier */
export declare function realizationMultiplier(avgRealizationPct: number, config: PricingEngineConfig): number;
/** Retail: Sales × Base % × Realization Multiplier */
export declare function computeRetailIncentive(input: {
    salesInr: number;
    avgRealizationPct: number;
    monthlyAchievementPct: number;
    config: PricingEngineConfig;
}): {
    basePct: number;
    multiplier: number;
    incentive: number;
};
/** Bulk: Gross Profit × Bonus Factor */
export declare function computeBulkIncentive(input: {
    grossProfitInr: number;
    salesInr: number;
    config: PricingEngineConfig;
}): {
    grossMarginPct: number;
    bonusPct: number;
    incentive: number;
    allowed: boolean;
    blockReason: string | null;
};
export declare function gradeFromScore(score: number): 'A+' | 'A' | 'B' | 'C' | 'Risk';
/** 100-point KPI model */
export declare function computeKpiScore(input: {
    salesAchievementPct: number;
    avgRealizationPct: number;
    profitContributionScore: number;
    repeatCustomersScore: number;
    collectionEfficiencyPct: number;
    returnComplaintCount: number;
}): {
    scoreSales: number;
    scoreRealization: number;
    scoreProfit: number;
    scoreRepeat: number;
    scoreCollection: number;
    scoreReturns: number;
    totalScore: number;
    grade: 'A+' | 'A' | 'B' | 'C' | 'Risk';
};
export declare function quarterlyBonusAmount(avgMonthlyScore: number, avgRealizationPct: number, config: PricingEngineConfig): {
    grade: 'A+' | 'A' | 'B' | 'C' | 'Risk';
    amount: number;
    eligible: boolean;
    note: string | null;
};
//# sourceMappingURL=incentive-formulas.d.ts.map