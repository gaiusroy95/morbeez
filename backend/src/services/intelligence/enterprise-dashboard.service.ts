import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { osAnalyticsService } from '../admin/os-analytics.service.js';
import { agronomistMobileService } from '../agronomist/agronomist-mobile.service.js';
import { outcomeIntelligenceService } from './outcome-intelligence.service.js';

export const executiveCockpitService = {
  async getCockpit(agentEmail?: string) {
    const email = agentEmail?.trim().toLowerCase() || '';
    const [maios, outcome, dashboard] = await Promise.all([
      osAnalyticsService.getMaiosKpis(30).catch(() => null),
      outcomeIntelligenceService.aggregateByIssue(undefined, 10).catch(() => []),
      email ? agronomistMobileService.getMobileDashboard(email).catch(() => null) : Promise.resolve(null),
    ]);
    let openEscalations = dashboard?.openEscalations ?? 0;
    if (!dashboard) {
      const { count } = await supabase
        .from('agronomist_escalations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'assigned', 'in_review']);
      openEscalations = count ?? 0;
    }
    return {
      visits: dashboard?.todaysVisits ?? 0,
      recoveryRate: maios?.d14RecoveryRate ?? null,
      aiAccuracy: maios?.avgEqs ?? null,
      escalationRate: maios?.agronomistOverrideRate ?? null,
      protocolSuccess: outcome[0]?.recoveryPct ?? null,
      openEscalations,
    };
  },
};

export const weaknessDashboardService = {
  async getWeakness(days = 90, eventType?: string) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let q = supabase
      .from('ai_training_events')
      .select('event_type, crop_type, issue_label, district')
      .gte('created_at', since)
      .in('event_type', ['correct_ai', 'partial_correct', 'wrong_recommendation', 'false_positive'])
      .limit(2000);
    if (eventType) q = q.eq('event_type', eventType);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load weakness data');
    const byLabel = new Map<string, number>();
    const byDistrict = new Map<string, number>();
    const byEventType = new Map<string, number>();
    for (const row of data ?? []) {
      const key = `${row.crop_type ?? 'unknown'}:${row.issue_label ?? 'unknown'}`;
      byLabel.set(key, (byLabel.get(key) ?? 0) + 1);
      const district = String(row.district ?? 'unknown');
      byDistrict.set(district, (byDistrict.get(district) ?? 0) + 1);
      const et = String(row.event_type ?? 'unknown');
      byEventType.set(et, (byEventType.get(et) ?? 0) + 1);
    }
    return {
      topMislabels: [...byLabel.entries()]
        .map(([key, count]) => {
          const [crop, label] = key.split(':');
          return { crop, label, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      districtDrift: [...byDistrict.entries()]
        .map(([district, count]) => ({ district, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
      byEventType: [...byEventType.entries()].map(([eventType, count]) => ({ eventType, count })),
      totalEvents: data?.length ?? 0,
    };
  },
};

export const resistanceDashboardService = {
  async aggregate(limit = 30) {
    const { data, error } = await supabase
      .from('ai_advisory_sessions')
      .select('metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    throwIfSupabaseError(error, 'Could not load resistance data');
    const buckets = new Map<string, { count: number; avgScore: number; total: number }>();
    for (const row of data ?? []) {
      const meta = row.metadata as { maiosCase?: { resistanceScore?: number; cropType?: string } } | null;
      const score = meta?.maiosCase?.resistanceScore;
      const crop = meta?.maiosCase?.cropType ?? 'unknown';
      if (score == null) continue;
      const prev = buckets.get(crop) ?? { count: 0, avgScore: 0, total: 0 };
      prev.count += 1;
      prev.total += score;
      prev.avgScore = prev.total / prev.count;
      buckets.set(crop, prev);
    }
    return [...buckets.entries()]
      .map(([crop, v]) => ({ crop, cases: v.count, avgResistanceScore: Math.round(v.avgScore) }))
      .sort((a, b) => b.avgResistanceScore - a.avgResistanceScore)
      .slice(0, limit);
  },
};
