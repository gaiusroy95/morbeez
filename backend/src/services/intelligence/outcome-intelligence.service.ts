import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export type OutcomeProtocolStats = {
  issueLabel: string;
  protocolLabel: string;
  sampleCount: number;
  recoveryPct: number;
  avgRecoveryDays: number | null;
};

export const outcomeIntelligenceService = {
  async recordVariant(input: {
    fieldFindingId?: string;
    recommendationRecordId?: string;
    issueLabel: string;
    protocolLabel: string;
    costInr?: number;
    expectedRecoveryPct?: number;
    metadata?: Record<string, unknown>;
  }) {
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

  async updateVariantOutcome(recommendationRecordId: string, outcome: string, recoveryDays?: number) {
    const { error } = await supabase
      .from('recommendation_variants')
      .update({
        actual_outcome: outcome,
        recovery_days: recoveryDays ?? null,
      })
      .eq('recommendation_record_id', recommendationRecordId);
    throwIfSupabaseError(error, 'Could not update variant outcome');
  },

  async aggregateByIssue(issueLabel?: string, limit = 20): Promise<OutcomeProtocolStats[]> {
    let q = supabase
      .from('recommendation_variants')
      .select('issue_label, protocol_label, actual_outcome, recovery_days, expected_recovery_pct')
      .not('actual_outcome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);
    if (issueLabel) q = q.ilike('issue_label', `%${issueLabel}%`);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not aggregate outcomes');

    const buckets = new Map<string, { improved: number; total: number; days: number[] }>();
    for (const row of data ?? []) {
      const key = `${row.issue_label}::${row.protocol_label}`;
      const b = buckets.get(key) ?? { improved: 0, total: 0, days: [] };
      b.total++;
      if (['better', 'improved', 'partial'].includes(String(row.actual_outcome))) b.improved++;
      if (row.recovery_days != null) b.days.push(Number(row.recovery_days));
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

  async rankVerifiedCasesForRetrieval(issueLabel: string): Promise<string[]> {
    const stats = await this.aggregateByIssue(issueLabel, 5);
    return stats.filter((s) => s.sampleCount >= 2).map((s) => s.protocolLabel);
  },
};
