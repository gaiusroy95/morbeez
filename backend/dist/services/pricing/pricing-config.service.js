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