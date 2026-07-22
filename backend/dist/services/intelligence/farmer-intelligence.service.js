import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { farmerHealthScoreService } from '../whatsapp/pipeline/farmer-health-score.service.js';
import { communicationTimelineService } from './communication-timeline.service.js';
import { opportunityIntelligenceDashboardService } from './opportunity-intelligence-dashboard.service.js';
export const farmerIntelligenceService = {
    async getFarmer360(farmerId) {
        const { data: farmer, error } = await supabase
            .from('farmers')
            .select('id, phone, name, first_name, last_name, district, village')
            .eq('id', farmerId)
            .single();
        throwIfSupabaseError(error, 'Farmer not found');
        if (!farmer)
            throw new Error('Farmer not found');
        const name = [farmer.first_name, farmer.last_name].filter(Boolean).join(' ') ||
            String(farmer.name ?? 'Farmer');
        const [health, opportunity, retention, timelineEntries, orders] = await Promise.all([
            farmerHealthScoreService.compute(farmerId).catch(() => null),
            opportunityIntelligenceDashboardService.getFarmerProfile(farmerId).catch(() => null),
            supabase
                .from('farmer_retention_tracking')
                .select('risk_band')
                .eq('farmer_id', farmerId)
                .maybeSingle(),
            communicationTimelineService.buildForFarmer(farmerId, 25).catch(() => []),
            supabase
                .from('orders')
                .select('id, total_amount')
                .eq('farmer_id', farmerId)
                .limit(100),
        ]);
        const orderRows = orders.data ?? [];
        const complianceScore = Math.min(100, Math.round((health?.score ?? 50) * 0.4 +
            (opportunity?.retention?.riskBand === 'healthy' ? 30 : opportunity?.retention?.riskBand === 'watch' ? 15 : 0) +
            Math.min(30, orderRows.length * 5)));
        const riskScore = Math.max(0, 100 - complianceScore);
        const timeline = timelineEntries.map((row) => ({
            at: row.at,
            kind: row.kind,
            summary: row.summary,
        }));
        const profile = {
            farmerId,
            name,
            phone: farmer.phone ? String(farmer.phone) : null,
            district: farmer.district ? String(farmer.district) : null,
            village: farmer.village ? String(farmer.village) : null,
            healthBand: health?.band ?? null,
            retentionBand: retention.data?.risk_band
                ? String(retention.data.risk_band)
                : opportunity?.retention?.riskBand ?? null,
            complianceScore,
            riskScore,
            opportunityScore: opportunity?.score?.opportunityScore ?? null,
            purchaseSummary: {
                orderCount: orderRows.length,
                totalValue: orderRows.reduce((s, o) => s + Number(o.total_amount ?? 0), 0) || null,
            },
            timeline,
        };
        await supabase.from('farmer_intelligence_snapshots').insert({
            farmer_id: farmerId,
            health_band: profile.healthBand,
            retention_band: profile.retentionBand,
            compliance_score: profile.complianceScore,
            risk_score: profile.riskScore,
            opportunity_score: profile.opportunityScore,
            summary: profile,
        });
        return profile;
    },
};
//# sourceMappingURL=farmer-intelligence.service.js.map