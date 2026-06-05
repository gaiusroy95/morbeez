import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
const DEFAULTS = {
    targetGrossMarginPct: 30,
    recommendedPctOfListed: 95,
    safeMarginPctOfGross: 50,
    hardFloorMarginPctOfGross: 27,
    incentiveFactor: 0.2,
    platformCostPct: 2,
    adAllocationPct: 3,
    returnRiskPct: 2,
    realizationExcellent: 95,
    realizationGood: 90,
    realizationWarning: 85,
    bulkBonus25k: 300,
    bulkBonus50k: 700,
    bulkBonus100k: 1500,
    monthlySalesTargetInr: 600_000,
    bulkOrderThresholdInr: 25_000,
    bulkProfitBonusPct: 10,
    bulkMinGrossMarginPct: 12,
    retailBaseIncentive0_50: 0.01,
    retailBaseIncentive50_80: 0.02,
    retailBaseIncentive80_100: 0.03,
    retailBaseIncentive100Plus: 0.05,
    realizationMult95Plus: 1.0,
    realizationMult90_95: 0.7,
    realizationMult85_90: 0.4,
    realizationMultBelow85: 0.0,
    quarterlyBonusAPlus: 5000,
    quarterlyBonusA: 3000,
    aPlusMinRealizationPct: 90,
};
function mapRow(row) {
    return {
        targetGrossMarginPct: Number(row.target_gross_margin_pct) || DEFAULTS.targetGrossMarginPct,
        recommendedPctOfListed: Number(row.recommended_pct_of_listed) || DEFAULTS.recommendedPctOfListed,
        safeMarginPctOfGross: Number(row.safe_margin_pct_of_gross) || DEFAULTS.safeMarginPctOfGross,
        hardFloorMarginPctOfGross: Number(row.hard_floor_margin_pct_of_gross) || DEFAULTS.hardFloorMarginPctOfGross,
        incentiveFactor: Number(row.incentive_factor) || DEFAULTS.incentiveFactor,
        platformCostPct: Number(row.platform_cost_pct) || DEFAULTS.platformCostPct,
        adAllocationPct: Number(row.ad_allocation_pct) || DEFAULTS.adAllocationPct,
        returnRiskPct: Number(row.return_risk_pct) || DEFAULTS.returnRiskPct,
        realizationExcellent: Number(row.realization_excellent) || DEFAULTS.realizationExcellent,
        realizationGood: Number(row.realization_good) || DEFAULTS.realizationGood,
        realizationWarning: Number(row.realization_warning) || DEFAULTS.realizationWarning,
        bulkBonus25k: Number(row.bulk_bonus_25k) || DEFAULTS.bulkBonus25k,
        bulkBonus50k: Number(row.bulk_bonus_50k) || DEFAULTS.bulkBonus50k,
        bulkBonus100k: Number(row.bulk_bonus_100k) || DEFAULTS.bulkBonus100k,
        monthlySalesTargetInr: Number(row.monthly_sales_target_inr) || DEFAULTS.monthlySalesTargetInr,
        bulkOrderThresholdInr: Number(row.bulk_order_threshold_inr) || DEFAULTS.bulkOrderThresholdInr,
        bulkProfitBonusPct: Number(row.bulk_profit_bonus_pct) || DEFAULTS.bulkProfitBonusPct,
        bulkMinGrossMarginPct: Number(row.bulk_min_gross_margin_pct) || DEFAULTS.bulkMinGrossMarginPct,
        retailBaseIncentive0_50: Number(row.retail_base_incentive_0_50) || DEFAULTS.retailBaseIncentive0_50,
        retailBaseIncentive50_80: Number(row.retail_base_incentive_50_80) || DEFAULTS.retailBaseIncentive50_80,
        retailBaseIncentive80_100: Number(row.retail_base_incentive_80_100) || DEFAULTS.retailBaseIncentive80_100,
        retailBaseIncentive100Plus: Number(row.retail_base_incentive_100_plus) || DEFAULTS.retailBaseIncentive100Plus,
        realizationMult95Plus: Number(row.realization_mult_95_plus) ?? DEFAULTS.realizationMult95Plus,
        realizationMult90_95: Number(row.realization_mult_90_95) ?? DEFAULTS.realizationMult90_95,
        realizationMult85_90: Number(row.realization_mult_85_90) ?? DEFAULTS.realizationMult85_90,
        realizationMultBelow85: Number(row.realization_mult_below_85) ?? DEFAULTS.realizationMultBelow85,
        quarterlyBonusAPlus: Number(row.quarterly_bonus_a_plus) || DEFAULTS.quarterlyBonusAPlus,
        quarterlyBonusA: Number(row.quarterly_bonus_a) || DEFAULTS.quarterlyBonusA,
        aPlusMinRealizationPct: Number(row.a_plus_min_realization_pct) || DEFAULTS.aPlusMinRealizationPct,
    };
}
export const pricingConfigService = {
    async getConfig() {
        const { data, error } = await supabase.from('pricing_engine_config').select('*').limit(1).maybeSingle();
        throwIfSupabaseError(error, 'Load pricing config');
        return data ? mapRow(data) : DEFAULTS;
    },
    async updateConfig(patch) {
        const current = await this.getConfig();
        const merged = { ...current, ...patch };
        const { data: existing } = await supabase.from('pricing_engine_config').select('id').limit(1).maybeSingle();
        const row = {
            target_gross_margin_pct: merged.targetGrossMarginPct,
            recommended_pct_of_listed: merged.recommendedPctOfListed,
            safe_margin_pct_of_gross: merged.safeMarginPctOfGross,
            hard_floor_margin_pct_of_gross: merged.hardFloorMarginPctOfGross,
            incentive_factor: merged.incentiveFactor,
            platform_cost_pct: merged.platformCostPct,
            ad_allocation_pct: merged.adAllocationPct,
            return_risk_pct: merged.returnRiskPct,
            realization_excellent: merged.realizationExcellent,
            realization_good: merged.realizationGood,
            realization_warning: merged.realizationWarning,
            bulk_bonus_25k: merged.bulkBonus25k,
            bulk_bonus_50k: merged.bulkBonus50k,
            bulk_bonus_100k: merged.bulkBonus100k,
            monthly_sales_target_inr: merged.monthlySalesTargetInr,
            bulk_order_threshold_inr: merged.bulkOrderThresholdInr,
            bulk_profit_bonus_pct: merged.bulkProfitBonusPct,
            bulk_min_gross_margin_pct: merged.bulkMinGrossMarginPct,
            retail_base_incentive_0_50: merged.retailBaseIncentive0_50,
            retail_base_incentive_50_80: merged.retailBaseIncentive50_80,
            retail_base_incentive_80_100: merged.retailBaseIncentive80_100,
            retail_base_incentive_100_plus: merged.retailBaseIncentive100Plus,
            realization_mult_95_plus: merged.realizationMult95Plus,
            realization_mult_90_95: merged.realizationMult90_95,
            realization_mult_85_90: merged.realizationMult85_90,
            realization_mult_below_85: merged.realizationMultBelow85,
            quarterly_bonus_a_plus: merged.quarterlyBonusAPlus,
            quarterly_bonus_a: merged.quarterlyBonusA,
            a_plus_min_realization_pct: merged.aPlusMinRealizationPct,
            updated_at: new Date().toISOString(),
        };
        if (existing?.id) {
            const { error } = await supabase.from('pricing_engine_config').update(row).eq('id', existing.id);
            throwIfSupabaseError(error, 'Update pricing config');
        }
        else {
            const { error } = await supabase.from('pricing_engine_config').insert(row);
            throwIfSupabaseError(error, 'Insert pricing config');
        }
        return merged;
    },
};
//# sourceMappingURL=pricing-config.service.js.map