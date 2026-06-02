import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { farmerEventService } from './farmer-event.service.js';
import { employeeAttributionService } from './employee-attribution.service.js';
import { opportunityScoreStoreService } from './opportunity-score-store.service.js';
import { performanceBreakdownFromComponents } from './employee-performance-scoring.util.js';
import { MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD } from './employee-performance-scoring.util.js';
import type { FarmerEventType } from './farmer-event.types.js';
import type { FarmerEventRow } from './farmer-event.types.js';
import type { EmployeeFarmerAttributionRow } from './employee-attribution.types.js';
import type { FarmerScoreSnapshot } from './opportunity-score-store.service.js';
import {
  buildFarmerScorePresentation,
  type FarmerScorePresentation,
} from './intelligence-score-presentation.service.js';
import {
  fetchOpportunityScoresByFarmerIds,
  fetchRetentionByFarmerIds,
} from './intelligence-farmer-score-queries.util.js';

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type OpportunityDashboardOverview = {
  periodDays: number;
  kpis: {
    farmersScored: number;
    avgOpportunityScore: number;
    highOpportunityFarmers: number;
    atRiskFarmers: number;
    churnedFarmers: number;
    events30d: number;
    conversions30d: number;
    activeAttributions: number;
    employeesScored: number;
    lastFarmerScoreRun: string | null;
    lastEmployeeScoreRun: string | null;
  };
  retentionBands: Array<{ band: string; count: number }>;
  scoreDistribution: Array<{ bucket: string; count: number }>;
};

export type DistrictOpportunityRow = {
  district: string;
  farmerCount: number;
  scoredCount: number;
  avgOpportunityScore: number;
  atRiskCount: number;
  highOpportunityCount: number;
  intensity: number;
};

export type FarmerIntelligenceSummary = {
  opportunityLevel: string;
  engagementLevel: string;
  trustLevel: string;
  relationshipLevel: string;
  acrePotentialLevel: string;
  retentionRiskLabel: string;
};

export type FarmerIntelligenceProfile = {
  farmerId: string;
  farmer: {
    name: string | null;
    phone: string | null;
    district: string | null;
    state: string | null;
    totalAcreage: number | null;
  } | null;
  score: FarmerScoreSnapshot | null;
  retention: {
    riskBand: string;
    retentionScore: number;
    daysSinceLastInbound: number | null;
    calculatedAt: string;
  } | null;
  summary: FarmerIntelligenceSummary | null;
  presentation: FarmerScorePresentation | null;
  componentBreakdown: Array<{ label: string; points: number; max: number }>;
  recentEvents: FarmerEventRow[];
  attributions: EmployeeFarmerAttributionRow[];
};

function tierFromRatio(
  points: number,
  max: number,
  high: string,
  medium: string,
  low: string
): string {
  if (max <= 0) return low;
  const ratio = points / max;
  if (ratio >= 0.65) return high;
  if (ratio >= 0.35) return medium;
  return low;
}

export function buildFarmerSummary(
  score: FarmerScoreSnapshot | null,
  retention: FarmerIntelligenceProfile['retention']
): FarmerIntelligenceSummary | null {
  if (!score) return null;
  const c = score.components;
  const retentionRiskLabel =
    retention?.riskBand === 'healthy'
      ? 'Low'
      : retention?.riskBand === 'watch'
        ? 'Moderate'
        : retention?.riskBand === 'at_risk'
          ? 'High'
          : retention?.riskBand === 'churned'
            ? 'Churned'
            : 'Unknown';

  return {
    opportunityLevel: tierFromRatio(score.opportunityScore, 100, 'High', 'Medium', 'Developing'),
    engagementLevel: tierFromRatio(c.engagement, 20, 'High', 'Medium', 'Low'),
    trustLevel: tierFromRatio(c.trust, 15, 'Strong', 'Building', 'Early'),
    relationshipLevel: tierFromRatio(c.relationship, 10, 'Strong', 'Growing', 'Weak'),
    acrePotentialLevel: tierFromRatio(c.acrePotential + c.acreSize, 35, 'High', 'Medium', 'Low'),
    retentionRiskLabel,
  };
}

export const opportunityIntelligenceDashboardService = {
  async getOverview(periodDays = 30): Promise<OpportunityDashboardOverview> {
    const since = daysAgoIso(periodDays);

    const [
      { count: farmersScored },
      { data: scoreRows },
      { data: retentionRows },
      { count: events30d },
      { count: conversions30d },
      { count: activeAttributions },
      { count: employeesScored },
      { data: lastFarmer },
      { data: lastEmployee },
    ] = await Promise.all([
      supabase.from('farmer_scores').select('farmer_id', { count: 'exact', head: true }),
      supabase.from('farmer_scores').select('opportunity_score'),
      supabase.from('farmer_retention_tracking').select('risk_band'),
      supabase
        .from('farmer_events')
        .select('id', { count: 'exact', head: true })
        .gte('occurred_at', since),
      supabase
        .from('farmer_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'ORDER_CONVERTED')
        .gte('occurred_at', since),
      supabase
        .from('employee_farmer_attribution')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      supabase.from('employee_scores').select('employee_profile_id', { count: 'exact', head: true }),
      supabase
        .from('farmer_scores')
        .select('calculated_at')
        .order('calculated_at', { ascending: false })
        .limit(1),
      supabase
        .from('employee_scores')
        .select('calculated_at')
        .order('calculated_at', { ascending: false })
        .limit(1),
    ]);

    const scores = (scoreRows ?? []).map((r) => Number(r.opportunity_score));
    const avgOpportunityScore =
      scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    const highOpportunityFarmers = scores.filter((s) => s >= 70).length;

    const bandCounts = new Map<string, number>();
    for (const r of retentionRows ?? []) {
      const band = String(r.risk_band);
      bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1);
    }

    const buckets = [
      { bucket: '0–39', min: 0, max: 39 },
      { bucket: '40–59', min: 40, max: 59 },
      { bucket: '60–79', min: 60, max: 79 },
      { bucket: '80–100', min: 80, max: 100 },
    ];
    const scoreDistribution = buckets.map((b) => ({
      bucket: b.bucket,
      count: scores.filter((s) => s >= b.min && s <= b.max).length,
    }));

    return {
      periodDays,
      kpis: {
        farmersScored: farmersScored ?? 0,
        avgOpportunityScore,
        highOpportunityFarmers,
        atRiskFarmers: bandCounts.get('at_risk') ?? 0,
        churnedFarmers: bandCounts.get('churned') ?? 0,
        events30d: events30d ?? 0,
        conversions30d: conversions30d ?? 0,
        activeAttributions: activeAttributions ?? 0,
        employeesScored: employeesScored ?? 0,
        lastFarmerScoreRun: lastFarmer?.[0]?.calculated_at ? String(lastFarmer[0].calculated_at) : null,
        lastEmployeeScoreRun: lastEmployee?.[0]?.calculated_at
          ? String(lastEmployee[0].calculated_at)
          : null,
      },
      retentionBands: ['healthy', 'watch', 'at_risk', 'churned'].map((band) => ({
        band,
        count: bandCounts.get(band) ?? 0,
      })),
      scoreDistribution,
    };
  },

  async getDistrictHeatmap(limit = 40): Promise<DistrictOpportunityRow[]> {
    const { data: rows, error } = await supabase
      .from('farmers')
      .select('district, farmer_scores(opportunity_score), farmer_retention_tracking(risk_band)')
      .not('farmer_scores', 'is', null);

    throwIfSupabaseError(error, 'Could not load district heatmap');

    const byDistrict = new Map<
      string,
      { scores: number[]; atRisk: number; high: number }
    >();

    for (const row of rows ?? []) {
      const district = (row.district ? String(row.district) : 'Unknown').trim() || 'Unknown';
      const scoreRel = row.farmer_scores as { opportunity_score?: number } | { opportunity_score?: number }[] | null;
      const scoreObj = Array.isArray(scoreRel) ? scoreRel[0] : scoreRel;
      if (!scoreObj?.opportunity_score) continue;
      const score = Number(scoreObj.opportunity_score);
      const entry = byDistrict.get(district) ?? { scores: [], atRisk: 0, high: 0 };
      entry.scores.push(score);

      const retRel = row.farmer_retention_tracking as { risk_band?: string } | { risk_band?: string }[] | null;
      const ret = Array.isArray(retRel) ? retRel[0] : retRel;
      const band = ret?.risk_band ? String(ret.risk_band) : '';
      if (band === 'at_risk' || band === 'churned') entry.atRisk += 1;
      if (score >= 70) entry.high += 1;
      byDistrict.set(district, entry);
    }

    const result: DistrictOpportunityRow[] = [];
    for (const [district, stats] of byDistrict) {
      const avg =
        stats.scores.length > 0
          ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
          : 0;
      result.push({
        district,
        farmerCount: stats.scores.length,
        scoredCount: stats.scores.length,
        avgOpportunityScore: Math.round(avg * 10) / 10,
        atRiskCount: stats.atRisk,
        highOpportunityCount: stats.high,
        intensity: Math.min(100, Math.round(avg)),
      });
    }

    return result.sort((a, b) => b.avgOpportunityScore - a.avgOpportunityScore).slice(0, limit);
  },

  async listAtRiskFarmers(limit = 50): Promise<
    Array<{
      farmerId: string;
      name: string | null;
      phone: string | null;
      district: string | null;
      opportunityScore: number | null;
      riskBand: string;
      daysSinceLastInbound: number | null;
    }>
  > {
    const { data, error } = await supabase
      .from('farmer_retention_tracking')
      .select(
        'farmer_id, risk_band, days_since_last_inbound, farmers(name, phone, district)'
      )
      .in('risk_band', ['at_risk', 'churned'])
      .order('days_since_last_inbound', { ascending: false, nullsFirst: true })
      .limit(limit);

    throwIfSupabaseError(error, 'Could not list at-risk farmers');

    const farmerIds = (data ?? []).map((row) => String(row.farmer_id));
    const scoreByFarmer = await fetchOpportunityScoresByFarmerIds(farmerIds);

    return (data ?? []).map((row) => {
      const farmersRel = row.farmers as { name?: string; phone?: string; district?: string } | null;
      const fid = String(row.farmer_id);
      const opportunityScore = scoreByFarmer.get(fid);
      return {
        farmerId: fid,
        name: farmersRel?.name ? String(farmersRel.name) : null,
        phone: farmersRel?.phone ? String(farmersRel.phone) : null,
        district: farmersRel?.district ? String(farmersRel.district) : null,
        opportunityScore: opportunityScore != null ? opportunityScore : null,
        riskBand: String(row.risk_band),
        daysSinceLastInbound:
          row.days_since_last_inbound != null ? Number(row.days_since_last_inbound) : null,
      };
    });
  },

  async listTopFarmers(opts?: {
    limit?: number;
    minScore?: number;
    district?: string;
  }): Promise<
    Array<{
      farmerId: string;
      opportunityScore: number;
      name: string | null;
      phone: string | null;
      district: string | null;
      riskBand: string | null;
    }>
  > {
    const limit = Math.min(opts?.limit ?? 25, 100);
    let q = supabase
      .from('farmer_scores')
      .select('farmer_id, opportunity_score, farmers(name, phone, district)')
      .order('opportunity_score', { ascending: false })
      .limit(limit);

    if (opts?.minScore != null) q = q.gte('opportunity_score', opts.minScore);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list top farmers');

    let rows = data ?? [];
    if (opts?.district) {
      const d = opts.district.toLowerCase();
      rows = rows.filter((r) => {
        const farmersRel = r.farmers as { district?: string } | { district?: string }[];
        const f = Array.isArray(farmersRel) ? farmersRel[0] : farmersRel;
        return String(f?.district ?? '').toLowerCase() === d;
      });
    }

    const farmerIds = rows.map((row) => String(row.farmer_id));
    const retentionByFarmer = await fetchRetentionByFarmerIds(farmerIds);

    return rows.map((row) => {
      const farmersRel = row.farmers as { name?: string; phone?: string; district?: string } | null;
      const fid = String(row.farmer_id);
      const ret = retentionByFarmer.get(fid);
      return {
        farmerId: fid,
        opportunityScore: Number(row.opportunity_score),
        name: farmersRel?.name ? String(farmersRel.name) : null,
        phone: farmersRel?.phone ? String(farmersRel.phone) : null,
        district: farmersRel?.district ? String(farmersRel.district) : null,
        riskBand: ret?.riskBand ?? null,
      };
    });
  },

  async getFarmerProfile(farmerId: string): Promise<FarmerIntelligenceProfile> {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('id, name, phone, district, state, total_acreage')
      .eq('id', farmerId)
      .maybeSingle();

    const score = await opportunityScoreStoreService.getFarmerScore(farmerId);

    const { data: retention } = await supabase
      .from('farmer_retention_tracking')
      .select('risk_band, retention_score, days_since_last_inbound, calculated_at')
      .eq('farmer_id', farmerId)
      .maybeSingle();

    const signalSince = daysAgoIso(90);
    const [recentEvents, signalEvents] = await Promise.all([
      farmerEventService.listForFarmer(farmerId, { limit: 15 }),
      farmerEventService.listForFarmer(farmerId, { limit: 80, since: signalSince }),
    ]);
    const attributions = await employeeAttributionService.listForFarmer(farmerId, true);

    const componentBreakdown = score
      ? [
          { label: 'Engagement', points: score.components.engagement, max: 20 },
          { label: 'Trust', points: score.components.trust, max: 15 },
          { label: 'Acre size', points: score.components.acreSize, max: 15 },
          { label: 'Acre potential', points: score.components.acrePotential, max: 20 },
          { label: 'Relationship', points: score.components.relationship, max: 10 },
          { label: 'Advisory', points: score.components.advisoryCooperation, max: 10 },
          { label: 'Crop value', points: score.components.cropValue, max: 5 },
          { label: 'Referral', points: score.components.referralInfluence, max: 5 },
        ]
      : [];

    const retentionDto = retention
      ? {
          riskBand: String(retention.risk_band),
          retentionScore: Number(retention.retention_score),
          daysSinceLastInbound:
            retention.days_since_last_inbound != null
              ? Number(retention.days_since_last_inbound)
              : null,
          calculatedAt: String(retention.calculated_at),
        }
      : null;

    const presentation =
      score != null
        ? buildFarmerScorePresentation({
            score,
            retentionScore100: retentionDto?.retentionScore ?? null,
            factors: score.factors,
            recentEvents: signalEvents,
          })
        : null;

    return {
      farmerId,
      farmer: farmer
        ? {
            name: farmer.name ? String(farmer.name) : null,
            phone: farmer.phone ? String(farmer.phone) : null,
            district: farmer.district ? String(farmer.district) : null,
            state: farmer.state ? String(farmer.state) : null,
            totalAcreage: farmer.total_acreage != null ? Number(farmer.total_acreage) : null,
          }
        : null,
      score,
      retention: retentionDto,
      summary: buildFarmerSummary(score, retentionDto),
      presentation,
      componentBreakdown,
      recentEvents,
      attributions,
    };
  },

  async listEmployeeLeaderboard(limit = 25) {
    const { data, error } = await supabase
      .from('employee_scores')
      .select(
        'employee_profile_id, performance_score, attributed_farmer_count, calculated_at, employee_profiles(full_name, email, role)'
      )
      .gte('attributed_farmer_count', MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD)
      .order('performance_score', { ascending: false })
      .limit(Math.min(limit, 100));

    throwIfSupabaseError(error, 'Could not load employee leaderboard');

    return (data ?? []).map((row) => {
      const prof = row.employee_profiles as {
        full_name?: string;
        email?: string;
        role?: string;
      } | null;
      return {
        employeeProfileId: String(row.employee_profile_id),
        performanceScore: Number(row.performance_score),
        attributedFarmerCount: Number(row.attributed_farmer_count ?? 0),
        fullName: prof?.full_name ? String(prof.full_name) : null,
        email: prof?.email ? String(prof.email) : null,
        role: prof?.role ? String(prof.role) : null,
        calculatedAt: String(row.calculated_at),
      };
    });
  },

  async getEmployeeProfileForDashboard(employeeProfileId: string) {
    const score = await opportunityScoreStoreService.getEmployeeScore(employeeProfileId);
    if (!score) return null;
    return {
      ...score,
      performanceBreakdown: performanceBreakdownFromComponents(score.components),
      leaderboardEligible: score.attributedFarmerCount >= MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD,
    };
  },

  /** Event volume by type for dashboard chart (last N days). */
  async getEventVolumeByType(
    periodDays = 30,
    types?: FarmerEventType[]
  ): Promise<Array<{ eventType: string; count: number }>> {
    const since = daysAgoIso(periodDays);
    let q = supabase
      .from('farmer_events')
      .select('event_type')
      .gte('occurred_at', since);

    if (types?.length) q = q.in('event_type', types);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load event volume');

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const t = String(row.event_type);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count);
  },
};
