import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { EMPLOYEE_PERFORMANCE_WEIGHTS, FARMER_OPPORTUNITY_WEIGHTS, } from './opportunity-intelligence.types.js';
const DEFAULT_THRESHOLDS = {
    highOpportunityMin: 70,
    lowOpportunityMax: 35,
    autoCreateCrmTasks: true,
    autoNurtureLowScore: true,
    employeeAtRiskCohortPct: 0.35,
};
function mergeWeights(defaults, overrides) {
    return { ...defaults, ...overrides };
}
export const opportunityIntelligenceConfigService = {
    async get() {
        const { data, error } = await supabase
            .from('opportunity_intelligence_config')
            .select('*')
            .eq('id', 'default')
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load opportunity config');
        const farmerOverrides = data?.farmer_weight_overrides ?? {};
        const employeeOverrides = data?.employee_weight_overrides ?? {};
        const rawThresholds = data?.alert_thresholds ?? {};
        return {
            id: 'default',
            farmerWeightOverrides: farmerOverrides,
            employeeWeightOverrides: employeeOverrides,
            alertThresholds: { ...DEFAULT_THRESHOLDS, ...rawThresholds },
            effectiveFarmerWeights: mergeWeights(FARMER_OPPORTUNITY_WEIGHTS, farmerOverrides),
            effectiveEmployeeWeights: mergeWeights(EMPLOYEE_PERFORMANCE_WEIGHTS, employeeOverrides),
            updatedAt: data?.updated_at ? String(data.updated_at) : new Date().toISOString(),
        };
    },
    async update(input) {
        const current = await this.get();
        const payload = {
            farmer_weight_overrides: input.farmerWeightOverrides ?? current.farmerWeightOverrides,
            employee_weight_overrides: input.employeeWeightOverrides ?? current.employeeWeightOverrides,
            alert_thresholds: { ...current.alertThresholds, ...(input.alertThresholds ?? {}) },
            updated_at: new Date().toISOString(),
            updated_by: input.updatedByAdminId ?? null,
        };
        const { error } = await supabase
            .from('opportunity_intelligence_config')
            .upsert({ id: 'default', ...payload }, { onConflict: 'id' });
        throwIfSupabaseError(error, 'Could not update opportunity config');
        return this.get();
    },
    /** Rescale component points when admin adjusts max weights (Phase 6 calibration). */
    applyFarmerWeightOverrides(components, weights) {
        const keys = [
            'engagement',
            'trust',
            'acreSize',
            'acrePotential',
            'relationship',
            'advisoryCooperation',
            'cropValue',
            'referralInfluence',
        ];
        const weightKeyMap = {
            engagement: 'engagement',
            trust: 'trust',
            acreSize: 'acreSize',
            acrePotential: 'acrePotential',
            relationship: 'relationship',
            advisoryCooperation: 'advisoryCooperation',
            cropValue: 'cropValue',
            referralInfluence: 'referralInfluence',
        };
        const out = { ...components };
        for (const k of keys) {
            const defaultMax = FARMER_OPPORTUNITY_WEIGHTS[weightKeyMap[k]];
            const newMax = weights[weightKeyMap[k]];
            if (newMax === defaultMax)
                continue;
            const scaled = defaultMax > 0 ? Math.round((components[k] / defaultMax) * newMax) : 0;
            out[k] = Math.max(0, Math.min(newMax, scaled));
        }
        return out;
    },
    applyEmployeeWeightOverrides(components, weights) {
        const keys = [
            'engagementGrowth',
            'relationshipQuality',
            'retentionQuality',
            'trustBuilding',
            'delayedConversion',
            'farmerReactivation',
            'knowledgeContribution',
            'farmerSatisfaction',
        ];
        const weightKeyMap = {
            engagementGrowth: 'engagementGrowth',
            relationshipQuality: 'relationshipQuality',
            retentionQuality: 'retentionQuality',
            trustBuilding: 'trustBuilding',
            delayedConversion: 'delayedConversion',
            farmerReactivation: 'farmerReactivation',
            knowledgeContribution: 'knowledgeContribution',
            farmerSatisfaction: 'farmerSatisfaction',
        };
        const out = { ...components };
        for (const k of keys) {
            const defaultMax = EMPLOYEE_PERFORMANCE_WEIGHTS[weightKeyMap[k]];
            const newMax = weights[weightKeyMap[k]];
            if (newMax === defaultMax)
                continue;
            const scaled = defaultMax > 0 ? Math.round((components[k] / defaultMax) * newMax) : 0;
            out[k] = Math.max(0, Math.min(newMax, scaled));
        }
        return out;
    },
};
//# sourceMappingURL=opportunity-intelligence-config.service.js.map