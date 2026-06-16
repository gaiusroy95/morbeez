import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
const SEVERITY_INTERVAL_DAYS = {
    high: 3,
    medium: 7,
    low: 14,
};
const FUNGICIDE_INTERVAL_DAYS = 7;
function normalizeSeverity(severity) {
    if (severity === 'high' || severity === 'medium' || severity === 'low')
        return severity;
    return 'medium';
}
function isFungicideMaterial(material) {
    const haystack = `${material.category ?? ''} ${material.technicalName ?? ''}`.toLowerCase();
    return /fungicid|fungal|fungus/.test(haystack);
}
function addDaysIso(days, from = new Date()) {
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
function mapRow(row) {
    return {
        id: String(row.id),
        recommendationRecordId: String(row.recommendation_record_id),
        intervalDays: Number(row.interval_days),
        checkType: String(row.check_type),
        severity: normalizeSeverity(String(row.severity)),
        nextCheckAt: String(row.next_check_at),
        createdAt: String(row.created_at),
    };
}
export const monitoringPlanService = {
    resolveIntervalDays(severity, materials = []) {
        if (materials.some(isFungicideMaterial))
            return FUNGICIDE_INTERVAL_DAYS;
        return SEVERITY_INTERVAL_DAYS[normalizeSeverity(severity)];
    },
    resolveCheckType(materials = []) {
        if (materials.some(isFungicideMaterial))
            return 'fungicide_follow_up';
        return 'field_monitoring';
    },
    async createForRecommendation(recommendationRecordId, opts = {}) {
        const materials = opts.materials ?? [];
        const severity = normalizeSeverity(opts.severity);
        const intervalDays = opts.intervalDays ?? this.resolveIntervalDays(severity, materials);
        const checkType = opts.checkType ?? this.resolveCheckType(materials);
        const nextCheckAt = addDaysIso(intervalDays, opts.from ?? new Date());
        const { data, error } = await supabase
            .from('monitoring_plan_items')
            .insert({
            recommendation_record_id: recommendationRecordId,
            interval_days: intervalDays,
            check_type: checkType,
            severity,
            next_check_at: nextCheckAt,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create monitoring plan item');
        return mapRow(data);
    },
    async listByRecommendation(recommendationRecordId) {
        const { data, error } = await supabase
            .from('monitoring_plan_items')
            .select('*')
            .eq('recommendation_record_id', recommendationRecordId)
            .order('next_check_at', { ascending: true });
        throwIfSupabaseError(error, 'Could not load monitoring plan items');
        return (data ?? []).map((row) => mapRow(row));
    },
    async deleteForRecommendation(recommendationRecordId) {
        const { error } = await supabase
            .from('monitoring_plan_items')
            .delete()
            .eq('recommendation_record_id', recommendationRecordId);
        throwIfSupabaseError(error, 'Could not delete monitoring plan items');
    },
};
//# sourceMappingURL=monitoring-plan.service.js.map