import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { employeeProfileResolveService } from './employee-profile-resolve.service.js';
import { opportunityScoreStoreService } from './opportunity-score-store.service.js';
import { employeePerformanceEngineService } from './employee-performance-engine.service.js';
export const agronomistIntelligenceService = {
    async getWorkspaceIntelligence(agentEmail) {
        const email = agentEmail.trim().toLowerCase();
        const profileId = await employeeProfileResolveService.byEmail(email);
        let employeeScore = profileId
            ? await opportunityScoreStoreService.getEmployeeScore(profileId)
            : null;
        if (profileId && !employeeScore) {
            try {
                employeeScore = await employeePerformanceEngineService.scoreEmployee(profileId, email);
            }
            catch {
                employeeScore = null;
            }
        }
        const { count: openEscalations } = await supabase
            .from('agronomist_escalations')
            .select('id', { count: 'exact', head: true })
            .in('status', ['pending', 'assigned', 'in_review']);
        const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentFindings, error: findErr } = await supabase
            .from('crm_field_findings')
            .select('farmer_id, farmers(name, phone)')
            .eq('agronomist_name', email)
            .gte('visited_at', since90)
            .is('archived_at', null)
            .order('visited_at', { ascending: false })
            .limit(50);
        throwIfSupabaseError(findErr, 'Could not load agronomist findings');
        const farmerIds = [...new Set((recentFindings ?? []).map((r) => String(r.farmer_id)))];
        let highOpportunityFarmers = 0;
        let farmersNeedingTrust = 0;
        const focusFarmers = [];
        if (farmerIds.length > 0) {
            const [{ data: scores }, { data: retention }] = await Promise.all([
                supabase
                    .from('farmer_scores')
                    .select('farmer_id, opportunity_score, trust_score')
                    .in('farmer_id', farmerIds),
                supabase
                    .from('farmer_retention_tracking')
                    .select('farmer_id, risk_band')
                    .in('farmer_id', farmerIds),
            ]);
            const scoreMap = new Map((scores ?? []).map((s) => [
                String(s.farmer_id),
                {
                    opportunity: Number(s.opportunity_score),
                    trust: Number(s.trust_score ?? 0),
                },
            ]));
            const riskMap = new Map((retention ?? []).map((r) => [String(r.farmer_id), String(r.risk_band)]));
            for (const fid of farmerIds) {
                const s = scoreMap.get(fid);
                if (s && s.opportunity >= 70)
                    highOpportunityFarmers++;
                if (s && s.trust < 8)
                    farmersNeedingTrust++;
            }
            const seenFocus = new Set();
            for (const row of recentFindings ?? []) {
                const fid = String(row.farmer_id);
                if (seenFocus.has(fid))
                    continue;
                const farmer = row.farmers;
                const s = scoreMap.get(fid);
                const band = riskMap.get(fid) ?? null;
                const opp = s?.opportunity ?? null;
                if (opp == null && band !== 'at_risk')
                    continue;
                if ((opp != null && opp >= 65) || band === 'at_risk' || (s && s.trust < 8)) {
                    seenFocus.add(fid);
                    focusFarmers.push({
                        farmerId: fid,
                        farmerName: farmer?.name ?? farmer?.phone ?? 'Farmer',
                        opportunityScore: opp,
                        riskBand: band,
                        reason: band === 'at_risk'
                            ? 'Retention risk — deepen trust with follow-up'
                            : s && s.trust < 8
                                ? 'Low trust score — confirm recommendation adoption'
                                : 'High opportunity — prioritize advisory',
                    });
                }
            }
            focusFarmers.sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0));
        }
        return {
            employee: {
                profileId,
                performanceScore: employeeScore?.performanceScore ?? null,
                trustBuilding: employeeScore?.components.trustBuilding ?? null,
                knowledgeContribution: employeeScore?.components.knowledgeContribution ?? null,
                relationshipQuality: employeeScore?.components.relationshipQuality ?? null,
                attributedFarmers: employeeScore?.attributedFarmerCount ?? null,
                calculatedAt: employeeScore?.calculatedAt ?? null,
            },
            cohort: {
                openEscalations: openEscalations ?? 0,
                highOpportunityFarmers,
                farmersNeedingTrust,
            },
            focusFarmers: focusFarmers.slice(0, 8),
        };
    },
};
//# sourceMappingURL=agronomist-intelligence.service.js.map