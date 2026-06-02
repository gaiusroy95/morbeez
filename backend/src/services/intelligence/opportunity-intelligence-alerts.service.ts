import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { logger } from '../../lib/logger.js';
import { createTelecallerTask } from '../whatsapp/pipeline/telecaller-tasks.service.js';
import { opportunityIntelligenceConfigService } from './opportunity-intelligence-config.service.js';
import { MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD } from './employee-performance-scoring.util.js';
import { fetchOpportunityScoresByFarmerIds } from './intelligence-farmer-score-queries.util.js';

export type OpportunityAlertType =
  | 'farmer_at_risk'
  | 'farmer_churned'
  | 'high_opportunity_idle'
  | 'employee_at_risk_cohort';

export type OpportunityAlertRow = {
  id: string;
  alertType: OpportunityAlertType;
  severity: 'info' | 'warning' | 'critical';
  farmerId: string | null;
  employeeProfileId: string | null;
  leadId: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
};

function mapAlert(row: Record<string, unknown>): OpportunityAlertRow {
  return {
    id: String(row.id),
    alertType: String(row.alert_type) as OpportunityAlertType,
    severity: String(row.severity) as OpportunityAlertRow['severity'],
    farmerId: row.farmer_id ? String(row.farmer_id) : null,
    employeeProfileId: row.employee_profile_id ? String(row.employee_profile_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    title: String(row.title),
    body: row.body ? String(row.body) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    status: String(row.status),
    createdAt: String(row.created_at),
    acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null,
  };
}

function istDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

async function upsertAlert(input: {
  alertType: OpportunityAlertType;
  severity: OpportunityAlertRow['severity'];
  farmerId?: string | null;
  employeeProfileId?: string | null;
  leadId?: string | null;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<'created' | 'exists'> {
  const { data: existing } = await supabase
    .from('opportunity_intelligence_alerts')
    .select('id')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existing) return 'exists';

  const { error } = await supabase.from('opportunity_intelligence_alerts').insert({
    alert_type: input.alertType,
    severity: input.severity,
    farmer_id: input.farmerId ?? null,
    employee_profile_id: input.employeeProfileId ?? null,
    lead_id: input.leadId ?? null,
    title: input.title,
    body: input.body ?? null,
    metadata: input.metadata ?? {},
    idempotency_key: input.idempotencyKey,
    status: 'open',
  });

  if (error?.code === '23505') return 'exists';
  throwIfSupabaseError(error, 'Could not create opportunity alert');
  return 'created';
}

export const opportunityIntelligenceAlertsService = {
  async list(opts?: {
    status?: string;
    alertType?: OpportunityAlertType;
    limit?: number;
  }): Promise<OpportunityAlertRow[]> {
    const limit = Math.min(opts?.limit ?? 50, 200);
    let q = supabase
      .from('opportunity_intelligence_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (opts?.status) q = q.eq('status', opts.status);
    if (opts?.alertType) q = q.eq('alert_type', opts.alertType);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list opportunity alerts');
    return (data ?? []).map((r) => mapAlert(r as Record<string, unknown>));
  },

  async acknowledge(alertId: string, adminUserId: string): Promise<void> {
    const { error } = await supabase
      .from('opportunity_intelligence_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: adminUserId,
      })
      .eq('id', alertId)
      .eq('status', 'open');

    throwIfSupabaseError(error, 'Could not acknowledge alert');
  },

  async dismiss(alertId: string, adminUserId: string): Promise<void> {
    const { error } = await supabase
      .from('opportunity_intelligence_alerts')
      .update({
        status: 'dismissed',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: adminUserId,
      })
      .eq('id', alertId);

    throwIfSupabaseError(error, 'Could not dismiss alert');
  },

  /**
   * Scan retention + opportunity tables and open daily alerts (idempotent per IST day).
   */
  async generateDailyAlerts(): Promise<{
    created: number;
    skipped: number;
    farmerAtRisk: number;
    farmerChurned: number;
    highOpportunityIdle: number;
    employeeCohort: number;
  }> {
    const config = await opportunityIntelligenceConfigService.get();
    const dateKey = istDateKey();
    let created = 0;
    let skipped = 0;

    const { data: atRiskRows, error: atRiskErr } = await supabase
      .from('farmer_retention_tracking')
      .select(
        'farmer_id, risk_band, days_since_last_inbound, retention_score, farmers(name, phone)'
      )
      .in('risk_band', ['at_risk', 'churned'])
      .limit(500);

    throwIfSupabaseError(atRiskErr, 'Could not load at-risk farmers for alerts');

    const atRiskFarmerIds = (atRiskRows ?? []).map((r) => String(r.farmer_id));
    const scoreByFarmer = await fetchOpportunityScoresByFarmerIds(atRiskFarmerIds);

    let farmerAtRisk = 0;
    let farmerChurned = 0;

    for (const row of atRiskRows ?? []) {
      const farmerId = String(row.farmer_id);
      const band = String(row.risk_band);
      const alertType: OpportunityAlertType =
        band === 'churned' ? 'farmer_churned' : 'farmer_at_risk';
      if (alertType === 'farmer_churned') farmerChurned += 1;
      else farmerAtRisk += 1;

      const { data: lead } = await supabase
        .from('leads')
        .select('id, assigned_to')
        .eq('farmer_id', farmerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: ownerAttr } = await supabase
        .from('employee_farmer_attribution')
        .select('employee_profile_id')
        .eq('farmer_id', farmerId)
        .eq('attribution_type', 'relationship_owner')
        .eq('active', true)
        .order('last_touch_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const farmersRel = row.farmers as { name?: string; phone?: string } | null;
      const opportunityScore = scoreByFarmer.get(farmerId);
      const name = farmersRel?.name ?? farmersRel?.phone ?? farmerId.slice(0, 8);
      const daysSilent = row.days_since_last_inbound != null ? Number(row.days_since_last_inbound) : null;

      const result = await upsertAlert({
        alertType,
        severity: band === 'churned' ? 'critical' : 'warning',
        farmerId,
        employeeProfileId: ownerAttr?.employee_profile_id
          ? String(ownerAttr.employee_profile_id)
          : null,
        leadId: lead?.id ? String(lead.id) : null,
        title: band === 'churned' ? `Churned: ${name}` : `At risk: ${name}`,
        body:
          daysSilent != null
            ? `No inbound WhatsApp for ${daysSilent} days. Opportunity score ${opportunityScore ?? '—'}.`
            : `Retention band ${band}.`,
        metadata: {
          riskBand: band,
          daysSinceLastInbound: daysSilent,
          opportunityScore: opportunityScore ?? null,
          retentionScore: Number(row.retention_score),
        },
        idempotencyKey: `${alertType}:${farmerId}:${dateKey}`,
      });
      if (result === 'created') created += 1;
      else skipped += 1;
    }

    const { data: highOpp } = await supabase
      .from('farmer_scores')
      .select('farmer_id, opportunity_score, farmers(name)')
      .gte('opportunity_score', config.alertThresholds.highOpportunityMin)
      .order('opportunity_score', { ascending: false })
      .limit(80);

    let highOpportunityIdle = 0;
    const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    for (const row of highOpp ?? []) {
      const farmerId = String(row.farmer_id);
      const { count } = await supabase
        .from('farmer_events')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .gte('occurred_at', since14);

      if ((count ?? 0) > 0) continue;
      highOpportunityIdle += 1;

      const farmersRel = row.farmers as { name?: string } | null;
      const result = await upsertAlert({
        alertType: 'high_opportunity_idle',
        severity: 'info',
        farmerId,
        title: `High opportunity, low activity: ${farmersRel?.name ?? farmerId.slice(0, 8)}`,
        body: `Score ${row.opportunity_score} but no events in 14 days — relationship touch recommended.`,
        metadata: { opportunityScore: Number(row.opportunity_score) },
        idempotencyKey: `high_opportunity_idle:${farmerId}:${dateKey}`,
      });
      if (result === 'created') created += 1;
      else skipped += 1;
    }

    const { data: employees } = await supabase
      .from('employee_scores')
      .select('employee_profile_id, attributed_farmer_count, employee_profiles(full_name)')
      .gte('attributed_farmer_count', MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD);

    let employeeCohort = 0;
    const cohortThreshold = config.alertThresholds.employeeAtRiskCohortPct;

    for (const emp of employees ?? []) {
      const employeeProfileId = String(emp.employee_profile_id);
      const { data: attr } = await supabase
        .from('employee_farmer_attribution')
        .select('farmer_id')
        .eq('employee_profile_id', employeeProfileId)
        .eq('active', true);

      const farmerIds = (attr ?? []).map((a) => String(a.farmer_id));
      if (farmerIds.length < MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD) continue;

      const { data: retention } = await supabase
        .from('farmer_retention_tracking')
        .select('risk_band')
        .in('farmer_id', farmerIds);

      const atRiskCount = (retention ?? []).filter(
        (r) => r.risk_band === 'at_risk' || r.risk_band === 'churned'
      ).length;
      const pct = atRiskCount / farmerIds.length;
      if (pct < cohortThreshold) continue;

      employeeCohort += 1;
      const prof = emp.employee_profiles as { full_name?: string } | null;
      const result = await upsertAlert({
        alertType: 'employee_at_risk_cohort',
        severity: pct >= 0.5 ? 'critical' : 'warning',
        employeeProfileId,
        title: `At-risk cohort: ${prof?.full_name ?? 'Employee'}`,
        body: `${Math.round(pct * 100)}% of ${farmerIds.length} attributed farmers are at risk or churned.`,
        metadata: { atRiskPct: pct, attributedCount: farmerIds.length, atRiskCount },
        idempotencyKey: `employee_at_risk_cohort:${employeeProfileId}:${dateKey}`,
      });
      if (result === 'created') created += 1;
      else skipped += 1;
    }

    logger.info(
      { created, skipped, farmerAtRisk, farmerChurned, highOpportunityIdle, employeeCohort },
      'Opportunity intelligence daily alerts generated'
    );

    return {
      created,
      skipped,
      farmerAtRisk,
      farmerChurned,
      highOpportunityIdle,
      employeeCohort,
    };
  },

  /** Create CRM follow-up tasks for open farmer retention alerts. */
  async enqueueRetentionTasks(limit = 40): Promise<{ tasksCreated: number; alertsResolved: number }> {
    const config = await opportunityIntelligenceConfigService.get();
    if (!config.alertThresholds.autoCreateCrmTasks) {
      return { tasksCreated: 0, alertsResolved: 0 };
    }

    const alerts = await this.list({
      status: 'open',
      limit: Math.min(limit, 100),
    });

    const retentionAlerts = alerts.filter(
      (a) =>
        (a.alertType === 'farmer_at_risk' || a.alertType === 'farmer_churned') && a.farmerId
    );

    let tasksCreated = 0;
    let alertsResolved = 0;

    for (const alert of retentionAlerts) {
      const farmerId = alert.farmerId!;
      const priority = alert.alertType === 'farmer_churned' ? 'urgent' : 'high';

      const { count: existing } = await supabase
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .eq('status', 'pending')
        .ilike('title', '%Retention%');

      if ((existing ?? 0) > 0) {
        await supabase
          .from('opportunity_intelligence_alerts')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .eq('id', alert.id);
        alertsResolved += 1;
        continue;
      }

      await createTelecallerTask({
        farmerId,
        leadId: alert.leadId ?? undefined,
        title: 'Retention follow-up (opportunity intelligence)',
        notes: alert.body ?? alert.title,
        priority,
      });

      await supabase
        .from('opportunity_intelligence_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', alert.id);

      tasksCreated += 1;
      alertsResolved += 1;
    }

    return { tasksCreated, alertsResolved };
  },
};
