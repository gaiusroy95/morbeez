import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export const outcomeIntelligenceService = {
    async recordVariant(input) {
        const { error } = await supabase.from('recommendation_variants').insert({
            field_finding_id: input.fieldFindingId ?? null,
            recommendation_record_id: input.recommendationRecordId ?? null,
            issue_label: input.issueLabel.slice(0, 200),
            protocol_label: input.protocolLabel.slice(0, 200),
            cost_inr: input.costInr ?? null,
            expected_recovery_pct: input.expectedRecoveryPct ?? null,
            metadata: input.metadata ?? {},
        });
        throwIfSupabaseError(error, 'Could not record recommendation variant');
    },
    async updateVariantOutcome(recommendationRecordId, outcome, recoveryDays) {
        const { error } = await supabase
            .from('recommendation_variants')
            .update({
            actual_outcome: outcome,
            recovery_days: recoveryDays ?? null,
        })
            .eq('recommendation_record_id', recommendationRecordId);
        throwIfSupabaseError(error, 'Could not update variant outcome');
    },
    async aggregateByIssue(issueLabel, limit = 20) {
        let q = supabase
            .from('recommendation_variants')
            .select('issue_label, protocol_label, actual_outcome, recovery_days, expected_recovery_pct')
            .not('actual_outcome', 'is', null)
            .order('created_at', { ascending: false })
            .limit(500);
        if (issueLabel)
            q = q.ilike('issue_label', `%${issueLabel}%`);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not aggregate outcomes');
        const buckets = new Map();
        for (const row of data ?? []) {
            const key = `${row.issue_label}::${row.protocol_label}`;
            const b = buckets.get(key) ?? { improved: 0, total: 0, days: [] };
            b.total++;
            if (['better', 'improved', 'partial'].includes(String(row.actual_outcome)))
                b.improved++;
            if (row.recovery_days != null)
                b.days.push(Number(row.recovery_days));
            buckets.set(key, b);
        }
        return [...buckets.entries()]
            .map(([key, b]) => {
            const [issue, protocol] = key.split('::');
            return {
                issueLabel: issue ?? '',
                protocolLabel: protocol ?? '',
                sampleCount: b.total,
                recoveryPct: b.total ? Math.round((b.improved / b.total) * 100) : 0,
                avgRecoveryDays: b.days.length
                    ? Math.round(b.days.reduce((s, d) => s + d, 0) / b.days.length)
                    : null,
            };
        })
            .sort((a, b) => b.recoveryPct - a.recoveryPct)
            .slice(0, limit);
    },
    async rankVerifiedCasesForRetrieval(issueLabel) {
        const stats = await this.aggregateByIssue(issueLabel, 5);
        return stats.filter((s) => s.sampleCount >= 2).map((s) => s.protocolLabel);
    },
    async getProtocolFunnelStats(days = 90) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const dayBuckets = [3, 7, 14];
        const jobTypes = dayBuckets.flatMap((d) => [
            `maios_recovery_d${d}`,
            `ginger_sop_recovery_d${d}`,
        ]);
        const { data, error } = await supabase
            .from('advisory_automation_jobs')
            .select('job_type, status')
            .gte('scheduled_at', since)
            .in('job_type', jobTypes)
            .limit(5000);
        throwIfSupabaseError(error, 'Could not load protocol funnel jobs');
        const empty = () => ({ scheduled: 0, completed: 0, failed: 0 });
        const buckets = { d3: empty(), d7: empty(), d14: empty() };
        for (const row of data ?? []) {
            const match = String(row.job_type).match(/_d(\d+)$/);
            const day = match ? Number(match[1]) : 0;
            const key = day === 3 ? 'd3' : day === 7 ? 'd7' : day === 14 ? 'd14' : null;
            if (!key)
                continue;
            buckets[key].scheduled++;
            const status = String(row.status);
            if (status === 'completed')
                buckets[key].completed++;
            if (status === 'failed')
                buckets[key].failed++;
        }
        return buckets;
    },
    async compareVariantsByExperiment(experimentId) {
        const { data, error } = await supabase
            .from('recommendation_variants')
            .select('variant_key, actual_outcome, cost_inr, expected_recovery_pct')
            .eq('experiment_id', experimentId)
            .limit(1000);
        throwIfSupabaseError(error, 'Could not load experiment variants');
        const buckets = new Map();
        for (const row of data ?? []) {
            const key = String(row.variant_key ?? 'control');
            const b = buckets.get(key) ?? { improved: 0, total: 0, costs: [] };
            b.total++;
            if (['better', 'improved', 'partial'].includes(String(row.actual_outcome)))
                b.improved++;
            if (row.cost_inr != null)
                b.costs.push(Number(row.cost_inr));
            buckets.set(key, b);
        }
        return [...buckets.entries()]
            .map(([variantKey, b]) => ({
            variantKey,
            sampleCount: b.total,
            recoveryPct: b.total ? Math.round((b.improved / b.total) * 100) : 0,
            avgCostInr: b.costs.length
                ? Math.round(b.costs.reduce((s, c) => s + c, 0) / b.costs.length)
                : null,
        }))
            .sort((a, b) => b.recoveryPct - a.recoveryPct);
    },
};
//# sourceMappingURL=outcome-intelligence.service.js.map