import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { employeeProfileResolveService } from './employee-profile-resolve.service.js';
import { opportunityScoreStoreService } from './opportunity-score-store.service.js';
import { employeePerformanceEngineService } from './employee-performance-engine.service.js';
import { opportunityIntelligenceAlertsService } from './opportunity-intelligence-alerts.service.js';
import {
  buildEmployeeScorePresentation,
  type EmployeeScorePresentation,
} from './intelligence-score-presentation.service.js';

export type TelecallerPriorityFarmer = {
  leadId: string | null;
  farmerId: string;
  farmerName: string;
  opportunityScore: number;
  riskBand: string | null;
  reason: string;
};

export type TelecallerWorkspaceIntelligence = {
  employee: {
    profileId: string | null;
    performanceScore: number | null;
    relationshipQuality: number | null;
    engagementGrowth: number | null;
    retentionQuality: number | null;
    delayedConversion: number | null;
    attributedFarmers: number | null;
    calculatedAt: string | null;
    isEngineScore: boolean;
  };
  cohort: {
    highOpportunityCount: number;
    atRiskCount: number;
    churnedCount: number;
    openAlertsCount: number;
  };
  priorityFarmers: TelecallerPriorityFarmer[];
  suggestedActions: Array<{ id: string; title: string; detail: string }>;
  employeePresentation: EmployeeScorePresentation | null;
};

function displayName(farmer: { name?: string; first_name?: string; last_name?: string } | null): string {
  if (!farmer) return 'Farmer';
  if (farmer.name) return String(farmer.name);
  const parts = [farmer.first_name, farmer.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Farmer';
}

export const telecallerIntelligenceService = {
  async getWorkspaceIntelligence(agentEmail: string): Promise<TelecallerWorkspaceIntelligence> {
    const email = agentEmail.trim().toLowerCase();
    const profileId = await employeeProfileResolveService.byEmail(email);

    let employeeScore = profileId
      ? await opportunityScoreStoreService.getEmployeeScore(profileId)
      : null;

    if (profileId && !employeeScore) {
      try {
        employeeScore = await employeePerformanceEngineService.scoreEmployee(profileId, email);
      } catch {
        employeeScore = null;
      }
    }

    const { data: myLeads, error: leadsErr } = await supabase
      .from('leads')
      .select('id, farmer_id, farmers(name, first_name, last_name)')
      .eq('assigned_to', email);

    throwIfSupabaseError(leadsErr, 'Could not load assigned leads');

    const farmerIds = [...new Set((myLeads ?? []).map((r) => String(r.farmer_id)).filter(Boolean))];
    const leadByFarmer = new Map<string, string>();
    for (const row of myLeads ?? []) {
      leadByFarmer.set(String(row.farmer_id), String(row.id));
    }

    let highOpportunityCount = 0;
    let atRiskCount = 0;
    let churnedCount = 0;
    const priorityFarmers: TelecallerPriorityFarmer[] = [];

    if (farmerIds.length > 0) {
      const [{ data: scores }, { data: retention }] = await Promise.all([
        supabase
          .from('farmer_scores')
          .select('farmer_id, opportunity_score')
          .in('farmer_id', farmerIds),
        supabase
          .from('farmer_retention_tracking')
          .select('farmer_id, risk_band, retention_score, days_since_last_inbound')
          .in('farmer_id', farmerIds),
      ]);

      const scoreByFarmer = new Map(
        (scores ?? []).map((s) => [String(s.farmer_id), Number(s.opportunity_score)])
      );
      const retentionByFarmer = new Map(
        (retention ?? []).map((r) => [String(r.farmer_id), r])
      );

      for (const fid of farmerIds) {
        const score = scoreByFarmer.get(fid);
        const ret = retentionByFarmer.get(fid);
        const band = ret?.risk_band ? String(ret.risk_band) : null;

        if (score != null && score >= 70) highOpportunityCount++;
        if (band === 'at_risk') atRiskCount++;
        if (band === 'churned') churnedCount++;
      }

      const ranked = farmerIds
        .map((fid) => {
          const row = myLeads?.find((l) => String(l.farmer_id) === fid);
          const farmer = row?.farmers as {
            name?: string;
            first_name?: string;
            last_name?: string;
          } | null;
          const score = scoreByFarmer.get(fid) ?? 0;
          const ret = retentionByFarmer.get(fid);
          const band = ret?.risk_band ? String(ret.risk_band) : null;
          let reason = 'High opportunity — prioritize relationship';
          if (band === 'at_risk' || band === 'churned') {
            reason = 'Retention risk — callback recommended';
          } else if (score >= 70) {
            reason = 'Premium opportunity farmer';
          }
          return {
            leadId: leadByFarmer.get(fid) ?? null,
            farmerId: fid,
            farmerName: displayName(farmer),
            opportunityScore: score,
            riskBand: band,
            reason,
            sortKey: (band === 'at_risk' || band === 'churned' ? 1000 : 0) + score,
          };
        })
        .filter((r) => r.opportunityScore >= 50 || r.riskBand === 'at_risk' || r.riskBand === 'churned')
        .sort((a, b) => b.sortKey - a.sortKey)
        .slice(0, 8);

      for (const r of ranked) {
        priorityFarmers.push({
          leadId: r.leadId,
          farmerId: r.farmerId,
          farmerName: r.farmerName,
          opportunityScore: r.opportunityScore,
          riskBand: r.riskBand,
          reason: r.reason,
        });
      }
    }

    let openAlertsCount = 0;
    try {
      const alerts = await opportunityIntelligenceAlertsService.list({ status: 'open', limit: 200 });
      const assignedSet = new Set(farmerIds);
      openAlertsCount = alerts.filter((a) => a.farmerId && assignedSet.has(a.farmerId)).length;
    } catch {
      openAlertsCount = 0;
    }

    const suggestedActions: TelecallerWorkspaceIntelligence['suggestedActions'] = [];
    if (atRiskCount > 0) {
      suggestedActions.push({
        id: 'retention-callbacks',
        title: `Call ${atRiskCount} at-risk farmer${atRiskCount > 1 ? 's' : ''}`,
        detail: 'Retention engine flagged reduced engagement on your assigned leads.',
      });
    }
    if (highOpportunityCount > 0) {
      suggestedActions.push({
        id: 'premium-advisory',
        title: `Engage ${highOpportunityCount} high-opportunity farmer${highOpportunityCount > 1 ? 's' : ''}`,
        detail: 'Scores ≥70 — schedule visit or share agronomist recommendation.',
      });
    }
    if (openAlertsCount > 0) {
      suggestedActions.push({
        id: 'open-alerts',
        title: `Review ${openAlertsCount} intelligence alert${openAlertsCount > 1 ? 's' : ''}`,
        detail: 'See Intelligence → Opportunity → Alerts for full list.',
      });
    }

    const employeePresentation = employeeScore
      ? buildEmployeeScorePresentation(employeeScore)
      : null;

    return {
      employee: {
        profileId,
        performanceScore: employeeScore?.performanceScore ?? null,
        relationshipQuality: employeeScore?.components.relationshipQuality ?? null,
        engagementGrowth: employeeScore?.components.engagementGrowth ?? null,
        retentionQuality: employeeScore?.components.retentionQuality ?? null,
        delayedConversion: employeeScore?.components.delayedConversion ?? null,
        attributedFarmers: employeeScore?.attributedFarmerCount ?? null,
        calculatedAt: employeeScore?.calculatedAt ?? null,
        isEngineScore: Boolean(employeeScore),
      },
      cohort: {
        highOpportunityCount,
        atRiskCount,
        churnedCount,
        openAlertsCount,
      },
      priorityFarmers,
      suggestedActions,
      employeePresentation,
    };
  },

  async enrichLeadRows<T extends { farmerId: unknown }>(
    leads: T[]
  ): Promise<Array<T & { opportunityScore: number | null; retentionRiskBand: string | null }>> {
    const ids = leads.map((l) => String(l.farmerId)).filter(Boolean);
    if (!ids.length) {
      return leads.map((l) => ({ ...l, opportunityScore: null, retentionRiskBand: null }));
    }

    const [{ data: scores }, { data: retention }] = await Promise.all([
      supabase.from('farmer_scores').select('farmer_id, opportunity_score').in('farmer_id', ids),
      supabase
        .from('farmer_retention_tracking')
        .select('farmer_id, risk_band')
        .in('farmer_id', ids),
    ]);

    const scoreMap = new Map(
      (scores ?? []).map((s) => [String(s.farmer_id), Number(s.opportunity_score)])
    );
    const riskMap = new Map(
      (retention ?? []).map((r) => [String(r.farmer_id), String(r.risk_band)])
    );

    return leads.map((l) => ({
      ...l,
      opportunityScore: scoreMap.get(String(l.farmerId)) ?? null,
      retentionRiskBand: riskMap.get(String(l.farmerId)) ?? null,
    }));
  },
};
