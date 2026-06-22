import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { blockService } from '../core/block.service.js';

export type PlotIntelligenceTrends = {
  recurringIssues: Array<{ label: string; count: number; lastAt?: string }>;
  soilTrend?: { nitrogen?: number[]; potassium?: number[]; ph?: number[] };
  outcomeHistory: Array<{ issue: string; outcome: string | null; at: string }>;
  visitCount12m: number;
};

export const plotDigitalTwinService = {
  async buildSnapshot(blockId: string, farmerId: string): Promise<PlotIntelligenceTrends> {
    const block = await blockService.getById(blockId, farmerId).catch(() => null);

    const [{ data: findings }, { data: recs }, { data: diseaseHist }] = await Promise.all([
      supabase
        .from('crm_field_findings')
        .select('id, visited_at')
        .eq('block_id', blockId)
        .gte('visited_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('visited_at', { ascending: false }),
      supabase
        .from('recommendation_records')
        .select('issue_detected, outcome, created_at')
        .eq('block_id', blockId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('disease_history')
        .select('issue_label, recorded_at')
        .eq('farmer_id', farmerId)
        .order('recorded_at', { ascending: false })
        .limit(15),
    ]);

    const issueCounts = new Map<string, { count: number; lastAt?: string }>();
    for (const r of recs ?? []) {
      const label = String(r.issue_detected ?? '').trim();
      if (!label) continue;
      const prev = issueCounts.get(label) ?? { count: 0 };
      issueCounts.set(label, {
        count: prev.count + 1,
        lastAt: prev.lastAt ?? String(r.created_at),
      });
    }
    for (const d of diseaseHist ?? []) {
      const label = String(d.issue_label ?? '').trim();
      if (!label) continue;
      const prev = issueCounts.get(label) ?? { count: 0 };
      issueCounts.set(label, {
        count: prev.count + 1,
        lastAt: prev.lastAt ?? String(d.recorded_at),
      });
    }

    const recurringIssues = [...issueCounts.entries()]
      .map(([label, v]) => ({ label, count: v.count, lastAt: v.lastAt }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const outcomeHistory = (recs ?? []).slice(0, 10).map((r) => ({
      issue: String(r.issue_detected ?? 'issue'),
      outcome: r.outcome ? String(r.outcome) : null,
      at: String(r.created_at).slice(0, 10),
    }));

    const trends: PlotIntelligenceTrends = {
      recurringIssues,
      outcomeHistory,
      visitCount12m: findings?.length ?? 0,
    };

    await supabase.from('plot_intelligence_snapshots').insert({
      block_id: blockId,
      farmer_id: farmerId,
      crop_type: block?.cropType ?? null,
      season_label: block?.plantingDate ? String(block.plantingDate).slice(0, 4) : null,
      trends,
      recurring_issues: recurringIssues,
      outcome_summary: { items: outcomeHistory },
    });

    return trends;
  },

  async getLatest(blockId: string): Promise<PlotIntelligenceTrends | null> {
    const { data, error } = await supabase
      .from('plot_intelligence_snapshots')
      .select('trends, recurring_issues, outcome_summary')
      .eq('block_id', blockId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load plot intelligence');
    if (!data) return null;
    return {
      recurringIssues: (data.recurring_issues as PlotIntelligenceTrends['recurringIssues']) ?? [],
      outcomeHistory:
        ((data.outcome_summary as { items?: PlotIntelligenceTrends['outcomeHistory'] })?.items) ?? [],
      visitCount12m: Number((data.trends as { visitCount12m?: number })?.visitCount12m ?? 0),
      soilTrend: (data.trends as { soilTrend?: PlotIntelligenceTrends['soilTrend'] })?.soilTrend,
    };
  },

  formatForPrompt(trends: PlotIntelligenceTrends | null): string {
    if (!trends) return 'No plot memory on file';
    const lines = [`Visits (12m): ${trends.visitCount12m}`];
    if (trends.recurringIssues.length) {
      lines.push(
        'Recurring issues: ' +
          trends.recurringIssues.map((r) => `${r.label} (${r.count}x)`).join('; ')
      );
    }
    if (trends.outcomeHistory.length) {
      lines.push(
        'Recent outcomes: ' +
          trends.outcomeHistory.map((o) => `${o.issue}:${o.outcome ?? 'pending'}`).join('; ')
      );
    }
    return lines.join('\n');
  },
};
