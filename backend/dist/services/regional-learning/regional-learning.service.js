import { supabase } from '../../lib/supabase.js';
export const regionalLearningService = {
    async resolveCluster(params) {
        const { data: farmer } = await supabase
            .from('farmers')
            .select('district')
            .eq('id', params.farmerId)
            .maybeSingle();
        const district = farmer?.district ? String(farmer.district) : null;
        if (!district)
            return null;
        const phBand = params.soilPh == null
            ? 'unknown'
            : params.soilPh >= 7.5
                ? 'high'
                : params.soilPh <= 5.5
                    ? 'low'
                    : 'neutral';
        const clusterKey = `${params.cropType}:${district}:${phBand}`.toLowerCase();
        await supabase.from('regional_farm_clusters').upsert({
            cluster_key: clusterKey,
            crop_type: params.cropType,
            district,
            soil_ph_band: phBand,
            farm_count: 1,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'cluster_key' });
        return { clusterKey };
    },
    async topIssuePriors(cropType, district) {
        const { data } = await supabase
            .from('regional_issue_stats')
            .select('issue_label, case_count')
            .eq('crop_type', cropType)
            .eq('district', district)
            .order('case_count', { ascending: false })
            .limit(5);
        return (data ?? []).map((r) => ({
            issueLabel: String(r.issue_label),
            caseCount: Number(r.case_count ?? 0),
        }));
    },
    async recordIssueStat(district, cropType, issueLabel) {
        const { data: existing } = await supabase
            .from('regional_issue_stats')
            .select('id, case_count')
            .eq('district', district)
            .eq('crop_type', cropType)
            .eq('issue_label', issueLabel)
            .is('season', null)
            .maybeSingle();
        if (existing?.id) {
            await supabase
                .from('regional_issue_stats')
                .update({
                case_count: Number(existing.case_count) + 1,
                updated_at: new Date().toISOString(),
            })
                .eq('id', existing.id);
        }
        else {
            await supabase.from('regional_issue_stats').insert({
                district,
                crop_type: cropType,
                issue_label: issueLabel,
                case_count: 1,
            });
        }
    },
    async recordProtocolOutcome(params) {
        const { data: existing } = await supabase
            .from('regional_protocol_stats')
            .select('id, success_count, failure_count')
            .eq('district', params.district)
            .eq('crop_type', params.cropType)
            .eq('issue_label', params.issueLabel)
            .eq('protocol_key', params.protocolKey)
            .maybeSingle();
        if (existing?.id) {
            const success = Number(existing.success_count) + (params.success ? 1 : 0);
            const failure = Number(existing.failure_count) + (params.success ? 0 : 1);
            const total = success + failure;
            await supabase
                .from('regional_protocol_stats')
                .update({
                success_count: success,
                failure_count: failure,
                success_rate: total ? success / total : null,
                updated_at: new Date().toISOString(),
            })
                .eq('id', existing.id);
        }
        else {
            await supabase.from('regional_protocol_stats').insert({
                district: params.district,
                crop_type: params.cropType,
                issue_label: params.issueLabel,
                protocol_key: params.protocolKey,
                success_count: params.success ? 1 : 0,
                failure_count: params.success ? 0 : 1,
                success_rate: params.success ? 1 : 0,
            });
        }
    },
    async rankTemplates(cropType, district, issueLabel) {
        const { data } = await supabase
            .from('regional_protocol_stats')
            .select('protocol_key, success_rate')
            .eq('crop_type', cropType)
            .eq('district', district)
            .eq('issue_label', issueLabel)
            .order('success_rate', { ascending: false })
            .limit(10);
        return (data ?? []).map((r) => ({
            protocolKey: String(r.protocol_key),
            successRate: Number(r.success_rate ?? 0),
        }));
    },
};
//# sourceMappingURL=regional-learning.service.js.map