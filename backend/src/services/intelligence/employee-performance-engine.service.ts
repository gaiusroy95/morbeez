import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { employeeAttributionService } from './employee-attribution.service.js';
import { opportunityScoreStoreService } from './opportunity-score-store.service.js';
import type { EmployeeScoreSnapshot } from './opportunity-score-store.service.js';
import { opportunityIntelligenceConfigService } from './opportunity-intelligence-config.service.js';
import {
  computeEmployeeScoreComponents,
  type EmployeePerformanceSignals,
} from './employee-performance-scoring.util.js';

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const TRUST_EVENT_TYPES = ['ROI_ENTRY', 'RECOMMENDATION_APPLIED', 'RECOMMENDATION_APPROVED'];

async function loadSignals(
  employeeProfileId: string,
  agentEmail: string
): Promise<EmployeePerformanceSignals> {
  const since30 = daysAgoIso(30);
  const since60 = daysAgoIso(60);
  const since90 = daysAgoIso(90);
  const since180 = daysAgoIso(180);

  const attributions = await employeeAttributionService.listForEmployee(employeeProfileId, true);
  const farmerIds = [...new Set(attributions.map((a) => a.farmerId))];
  const attributedFarmerCount = farmerIds.length;

  const conversionAssists180d = attributions.filter(
    (a) => a.attributionType === 'conversion_assist' && a.lastTouchAt >= since180
  ).length;
  const reactivations90d = attributions.filter(
    (a) => a.attributionType === 'reactivation' && a.lastTouchAt >= since90
  ).length;

  let inboundEvents30d = 0;
  let inboundEventsPrev30d = 0;
  let outboundEvents30d = 0;
  let trustEvents90d = 0;

  if (farmerIds.length > 0) {
    const [{ count: in30 }, { count: inPrev }, { count: out30 }, { count: trust90 }] = await Promise.all([
      supabase
        .from('farmer_events')
        .select('id', { count: 'exact', head: true })
        .in('farmer_id', farmerIds)
        .in('event_type', ['MESSAGE_REPLY', 'IMAGE_UPLOAD', 'VOICE_NOTE'])
        .gte('occurred_at', since30),
      supabase
        .from('farmer_events')
        .select('id', { count: 'exact', head: true })
        .in('farmer_id', farmerIds)
        .in('event_type', ['MESSAGE_REPLY', 'IMAGE_UPLOAD', 'VOICE_NOTE'])
        .gte('occurred_at', since60)
        .lt('occurred_at', since30),
      supabase
        .from('farmer_events')
        .select('id', { count: 'exact', head: true })
        .in('farmer_id', farmerIds)
        .eq('event_type', 'MESSAGE_SENT')
        .gte('occurred_at', since30),
      supabase
        .from('farmer_events')
        .select('id', { count: 'exact', head: true })
        .in('farmer_id', farmerIds)
        .in('event_type', TRUST_EVENT_TYPES)
        .gte('occurred_at', since90),
    ]);

    inboundEvents30d = in30 ?? 0;
    inboundEventsPrev30d = inPrev ?? 0;
    outboundEvents30d = out30 ?? 0;
    trustEvents90d = trust90 ?? 0;
  }

  const { count: staffEvents30d } = await supabase
    .from('farmer_events')
    .select('id', { count: 'exact', head: true })
    .eq('employee_profile_id', employeeProfileId)
    .gte('occurred_at', since30);

  outboundEvents30d += staffEvents30d ?? 0;

  const { count: crmTasksCompleted30d } = await supabase
    .from('crm_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', agentEmail)
    .eq('status', 'done')
    .gte('completed_at', since30);

  let avgFarmerRelationshipScore: number | null = null;
  let avgFarmerOpportunityScore: number | null = null;
  let healthyRetentionPct: number | null = null;

  if (farmerIds.length > 0) {
    const { data: scores } = await supabase
      .from('farmer_scores')
      .select('relationship_score, opportunity_score')
      .in('farmer_id', farmerIds);

    if (scores?.length) {
      avgFarmerRelationshipScore =
        scores.reduce((s, r) => s + Number(r.relationship_score ?? 0), 0) / scores.length;
      avgFarmerOpportunityScore =
        scores.reduce((s, r) => s + Number(r.opportunity_score ?? 0), 0) / scores.length;
    }

    const { data: retention } = await supabase
      .from('farmer_retention_tracking')
      .select('risk_band')
      .in('farmer_id', farmerIds);

    if (retention?.length) {
      const healthy = retention.filter((r) =>
        ['healthy', 'watch'].includes(String(r.risk_band))
      ).length;
      healthyRetentionPct = healthy / retention.length;
    }
  }

  const { count: recommendationsApproved90d } = await supabase
    .from('recommendation_history')
    .select('id', { count: 'exact', head: true })
    .eq('employee_profile_id', employeeProfileId)
    .eq('milestone', 'approved')
    .gte('occurred_at', since90);

  const { count: recommendationsCommunicated90d } = await supabase
    .from('recommendation_history')
    .select('id', { count: 'exact', head: true })
    .eq('employee_profile_id', employeeProfileId)
    .eq('milestone', 'communicated')
    .gte('occurred_at', since90);

  let positiveOutcomes90d = 0;
  if (farmerIds.length > 0) {
    const { count } = await supabase
      .from('recommendation_records')
      .select('id', { count: 'exact', head: true })
      .in('farmer_id', farmerIds)
      .eq('outcome', 'better')
      .gte('outcome_at', since90);
    positiveOutcomes90d = count ?? 0;
  }

  const { count: activityEvidence30d } = await supabase
    .from('activity_evidence_logs')
    .select('id', { count: 'exact', head: true })
    .eq('employee_profile_id', employeeProfileId)
    .gte('event_date', since30.slice(0, 10));

  return {
    attributedFarmerCount,
    inboundEvents30d,
    inboundEventsPrev30d,
    outboundEvents30d,
    crmTasksCompleted30d: crmTasksCompleted30d ?? 0,
    avgFarmerRelationshipScore,
    avgFarmerOpportunityScore,
    healthyRetentionPct,
    trustEvents90d,
    conversionAssists180d,
    reactivations90d,
    recommendationsApproved90d: recommendationsApproved90d ?? 0,
    recommendationsCommunicated90d: recommendationsCommunicated90d ?? 0,
    positiveOutcomes90d,
    activityEvidence30d: activityEvidence30d ?? 0,
  };
}

export const employeePerformanceEngineService = {
  async scoreEmployee(employeeProfileId: string, agentEmail: string): Promise<EmployeeScoreSnapshot> {
    const signals = await loadSignals(employeeProfileId, agentEmail);
    const { components: rawComponents, factors } = computeEmployeeScoreComponents(signals);
    const config = await opportunityIntelligenceConfigService.get();
    const components = opportunityIntelligenceConfigService.applyEmployeeWeightOverrides(
      rawComponents,
      config.effectiveEmployeeWeights
    );

    return opportunityScoreStoreService.upsertEmployeeScore(
      employeeProfileId,
      components,
      factors,
      signals.attributedFarmerCount
    );
  },

  async listProfileIdsForBatch(limit = 200): Promise<Array<{ profileId: string; email: string }>> {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('id, email, admin_user_id, status')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(limit);

    throwIfSupabaseError(error, 'Could not list employees for scoring');

    const rows: Array<{ profileId: string; email: string }> = [];

    for (const row of data ?? []) {
      let email = row.email ? String(row.email).trim().toLowerCase() : '';
      if (!email && row.admin_user_id) {
        const { data: admin } = await supabase
          .from('admin_users')
          .select('email')
          .eq('id', row.admin_user_id)
          .maybeSingle();
        email = admin?.email ? String(admin.email).trim().toLowerCase() : '';
      }
      if (!email) continue;
      rows.push({ profileId: String(row.id), email });
    }

    return rows;
  },

  async runBatch(opts?: { limit?: number; dryRun?: boolean; employeeProfileId?: string }): Promise<{
    scored: number;
    skipped: number;
    errors: number;
    dryRun: boolean;
  }> {
    const dryRun = Boolean(opts?.dryRun);
    const targets = opts?.employeeProfileId
      ? [{ profileId: opts.employeeProfileId, email: '' }]
      : await this.listProfileIdsForBatch(opts?.limit);

    let scored = 0;
    let errors = 0;

    for (const target of targets) {
      try {
        if (dryRun) continue;

        let email = target.email;
        if (!email) {
          const { data: profile } = await supabase
            .from('employee_profiles')
            .select('email, admin_user_id')
            .eq('id', target.profileId)
            .maybeSingle();
          email = profile?.email ? String(profile.email).trim().toLowerCase() : '';
          if (!email && profile?.admin_user_id) {
            const { data: admin } = await supabase
              .from('admin_users')
              .select('email')
              .eq('id', profile.admin_user_id)
              .maybeSingle();
            email = admin?.email ? String(admin.email).trim().toLowerCase() : '';
          }
        }
        if (!email) {
          errors++;
          continue;
        }

        await this.scoreEmployee(target.profileId, email);
        scored++;
      } catch (err) {
        errors++;
        logger.warn({ err, profileId: target.profileId }, 'Employee performance score failed');
      }
    }

    return {
      scored,
      skipped: dryRun ? targets.length : 0,
      errors,
      dryRun,
    };
  },
};
