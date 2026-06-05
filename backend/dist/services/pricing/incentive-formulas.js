export function classifyOrderType(orderTotalInr, config) {
    return orderTotalInr > config.bulkOrderThresholdInr ? 'bulk' : 'retail';
}
/** Monthly target achievement → base incentive % */
export function baseIncentivePct(achievementPct, config) {
    if (achievementPct >= 100)
        return config.retailBaseIncentive100Plus;
    if (achievementPct >= 80)
        return config.retailBaseIncentive80_100;
    if (achievementPct >= 50)
        return config.retailBaseIncentive50_80;
    return config.retailBaseIncentive0_50;
}
/** Avg realization % → multiplier */
export function realizationMultiplier(avgRealizationPct, config) {
    if (avgRealizationPct >= 95)
        return config.realizationMult95Plus;
    if (avgRealizationPct >= 90)
        return config.realizationMult90_95;
    if (avgRealizationPct >= 85)
        return config.realizationMult85_90;
    return config.realizationMultBelow85;
}
/** Retail: Sales × Base % × Realization Multiplier */
export function computeRetailIncentive(input) {
    const basePct = baseIncentivePct(input.monthlyAchievementPct, input.config);
    const multiplier = realizationMultiplier(input.avgRealizationPct, input.config);
    const incentive = Math.round(input.salesInr * basePct * multiplier * 100) / 100;
    return { basePct, multiplier, incentive };
}
/** Bulk: Gross Profit × Bonus Factor */
export function computeBulkIncentive(input) {
    const grossMarginPct = input.salesInr > 0 ? (input.grossProfitInr / input.salesInr) * 100 : 0;
    const minMargin = input.config.bulkMinGrossMarginPct;
    const allowed = grossMarginPct >= minMargin;
    const bonusPct = input.config.bulkProfitBonusPct / 100;
    const incentive = allowed ? Math.round(input.grossProfitInr * bonusPct * 100) / 100 : 0;
    return {
        grossMarginPct: Math.round(grossMarginPct * 100) / 100,
        bonusPct: input.config.bulkProfitBonusPct,
        incentive,
        allowed,
        blockReason: allowed
            ? null
            : `Bulk order needs minimum ${minMargin}% gross margin (current ${grossMarginPct.toFixed(1)}%) — owner review required`,
    };
}
export function gradeFromScore(score) {
    if (score >= 90)
        return 'A+';
    if (score >= 80)
        return 'A';
    if (score >= 70)
        return 'B';
    if (score >= 60)
        return 'C';
    return 'Risk';
}
/** 100-point KPI model */
export function computeKpiScore(input) {
    const scoreSales = Math.min(35, (input.salesAchievementPct / 100) * 35);
    const scoreRealization = Math.min(30, (input.avgRealizationPct / 100) * 30);
    const scoreProfit = Math.min(20, input.profitContributionScore);
    const scoreRepeat = Math.min(5, input.repeatCustomersScore);
    const scoreCollection = Math.min(5, (input.collectionEfficiencyPct / 100) * 5);
    const scoreReturns = Math.max(0, 5 - Math.min(5, input.returnComplaintCount));
    const totalScore = Math.round((scoreSales + scoreRealization + scoreProfit + scoreRepeat + scoreCollection + scoreReturns) * 100) / 100;
    return {
        scoreSales: Math.round(scoreSales * 100) / 100,
        scoreRealization: Math.round(scoreRealization * 100) / 100,
        scoreProfit: Math.round(scoreProfit * 100) / 100,
        scoreRepeat: Math.round(scoreRepeat * 100) / 100,
        scoreCollection: Math.round(scoreCollection * 100) / 100,
        scoreReturns: Math.round(scoreReturns * 100) / 100,
        totalScore,
        grade: gradeFromScore(totalScore),
    };
}
export function quarterlyBonusAmount(avgMonthlyScore, avgRealizationPct, config) {
    const grade = gradeFromScore(avgMonthlyScore);
    if (grade === 'A+') {
        if (avgRealizationPct < config.aPlusMinRealizationPct) {
            return {
                grade: 'A',
                amount: config.quarterlyBonusA,
                eligible: true,
                note: `A+ blocked — avg realization ${avgRealizationPct.toFixed(1)}% below ${config.aPlusMinRealizationPct}% minimum`,
            };
        }
        return { grade: 'A+', amount: config.quarterlyBonusAPlus, eligible: true, note: null };
    }
    if (grade === 'A')
        return { grade: 'A', amount: config.quarterlyBonusA, eligible: true, note: null };
    if (grade === 'B')
        return { grade: 'B', amount: 0, eligible: false, note: 'No quarterly bonus for grade B' };
    if (grade === 'C')
        return { grade: 'C', amount: 0, eligible: false, note: 'Warning — grade C' };
    return { grade: 'Risk', amount: 0, eligible: false, note: 'Performance review required — grade Risk' };
}
//# sourceMappingURL=incentive-formulas.js.map