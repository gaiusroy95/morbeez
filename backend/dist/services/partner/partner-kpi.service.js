import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { monthKey, monthLastDay, monthRange } from '../../domain/remuneration/rule-workflow.js';
import { scoreWeightedKpi } from '../../domain/remuneration/weighted-kpi.js';
import { partnerSettingsService } from './partner-settings.service.js';
import { earningRulesService } from '../remuneration/earning-rules.service.js';
function pct(num, den) {
    if (den <= 0)
        return 0;
    return Math.round((num / den) * 1000) / 10;
}
export const partnerKpiService = {
    async computeMonthlySnapshot(partnerId, periodStart, periodEnd) {
        const month = monthKey(periodStart);
        const asOf = monthLastDay(month);
        const { startIso, endIso } = monthRange(month);
        const weights = await earningRulesService.partnerKpiWeights(asOf);
        const { count: farmerGrowth } = await supabase
            .from('partner_farmer_attribution')
            .select('id', { count: 'exact', head: true })
            .eq('partner_id', partnerId)
            .eq('attribution_type', 'enrollment')
            .gte('first_touch_at', startIso)
            .lte('first_touch_at', endIso);
        const { count: attributedBefore } = await supabase
            .from('partner_farmer_attribution')
            .select('id', { count: 'exact', head: true })
            .eq('partner_id', partnerId)
            .lt('first_touch_at', startIso);
        const { count: retainedVisits } = await supabase
            .from('crm_field_findings')
            .select('id', { count: 'exact', head: true })
            .eq('partner_id', partnerId)
            .gte('created_at', startIso)
            .lte('created_at', endIso);
        const { count: visits } = await supabase
            .from('crm_field_findings')
            .select('id', { count: 'exact', head: true })
            .eq('partner_id', partnerId)
            .gte('created_at', startIso)
            .lte('created_at', endIso);
        const { count: tasksTotal } = await supabase
            .from('crm_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_partner_id', partnerId)
            .gte('created_at', startIso)
            .lte('created_at', endIso);
        const { count: tasksDone } = await supabase
            .from('crm_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_partner_id', partnerId)
            .eq('status', 'completed')
            .gte('created_at', startIso)
            .lte('created_at', endIso);
        const visitCompletionPct = pct(tasksDone ?? 0, tasksTotal ?? 0);
        const { data: partner } = await supabase
            .from('partners')
            .select('reliability_score, performance_score, current_active_farmers, max_active_farmers')
            .eq('id', partnerId)
            .single();
        const { data: eligibleOrders } = await supabase
            .from('commerce_orders')
            .select('id, total_amount, oms_status, payment_status, incentive_eligibility')
            .eq('attributed_partner_id', partnerId)
            .gte('incentive_eligible_at', startIso)
            .lte('incentive_eligible_at', endIso);
        const eligibleSales = (eligibleOrders ?? [])
            .filter((o) => o.incentive_eligibility === 'eligible')
            .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
        const { data: partnerOrders } = await supabase
            .from('commerce_orders')
            .select('oms_status, payment_status')
            .eq('attributed_partner_id', partnerId)
            .gte('created_at', startIso)
            .lte('created_at', endIso);
        const delivered = (partnerOrders ?? []).filter((o) => ['delivered', 'completed'].includes(String(o.oms_status ?? ''))).length;
        const collected = (partnerOrders ?? []).filter((o) => ['delivered', 'completed'].includes(String(o.oms_status ?? '')) &&
            ['paid', 'partially_paid'].includes(String(o.payment_status ?? ''))).length;
        const { count: leadsOffered } = await supabase
            .from('partner_lead_allocations')
            .select('id', { count: 'exact', head: true })
            .eq('partner_id', partnerId)
            .gte('offered_at', startIso)
            .lte('offered_at', endIso);
        const { count: leadsAccepted } = await supabase
            .from('partner_lead_allocations')
            .select('id', { count: 'exact', head: true })
            .eq('partner_id', partnerId)
            .eq('status', 'accepted')
            .gte('offered_at', startIso)
            .lte('offered_at', endIso);
        const { count: eventsDone } = await supabase
            .from('partner_events')
            .select('id', { count: 'exact', head: true })
            .eq('partner_id', partnerId)
            .eq('status', 'completed')
            .gte('starts_at', startIso)
            .lte('starts_at', endIso);
        const maxFarmers = Number(partner?.max_active_farmers ?? 50) || 50;
        const activeFarmers = Number(partner?.current_active_farmers ?? 0);
        const retentionPct = pct(retainedVisits ?? 0, attributedBefore ?? 0);
        const territoryPct = pct(activeFarmers, maxFarmers);
        const collectionsPct = pct(collected, delivered);
        const leadResponsePct = pct(leadsAccepted ?? 0, leadsOffered ?? 0);
        const advocacyPct = (eventsDone ?? 0) > 0 ? 100 : 0;
        const reportingPct = visitCompletionPct;
        const actuals = {
            eligible_sales: eligibleSales,
            farmer_retention: retentionPct,
            field_service: visitCompletionPct,
            territory: territoryPct,
            collections: collectionsPct,
            advocacy: advocacyPct,
            lead_response: leadResponsePct,
            reporting: reportingPct,
        };
        const scored = scoreWeightedKpi(weights.parameters, actuals);
        const performanceScore = scored.total;
        const row = {
            partner_id: partnerId,
            period_start: periodStart.toISOString().slice(0, 10),
            period_end: periodEnd.toISOString().slice(0, 10),
            farmer_growth: farmerGrowth ?? 0,
            farmer_retention_pct: retentionPct,
            visit_completion_pct: visitCompletionPct,
            data_quality_pct: reportingPct,
            recommendation_success_pct: 0,
            revenue_influence_inr: eligibleSales,
            lead_generation_count: farmerGrowth ?? 0,
            reliability_score: Number(partner?.reliability_score ?? 70),
            performance_score: performanceScore,
            metadata: {
                visits: visits ?? 0,
                month,
                ruleVersionId: weights.versionId,
                lines: scored.lines,
                actuals,
            },
        };
        const { data, error } = await supabase
            .from('partner_kpi_snapshots')
            .upsert(row, { onConflict: 'partner_id,period_start,period_end' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not save KPI snapshot');
        await supabase
            .from('partners')
            .update({ performance_score: performanceScore, updated_at: new Date().toISOString() })
            .eq('id', partnerId);
        return data;
    },
    async recomputeAllForMonth(month) {
        const { start, end } = monthRange(month);
        const { data: partners } = await supabase.from('partners').select('id').eq('status', 'active');
        const saved = [];
        for (const p of partners ?? []) {
            saved.push(await this.computeMonthlySnapshot(String(p.id), start, end));
        }
        return saved;
    },
    async maybePromoteTier(partnerId) {
        const thresholds = await partnerSettingsService.get('tier_thresholds');
        const { data: partner } = await supabase
            .from('partners')
            .select('tier, reliability_score, current_active_farmers')
            .eq('id', partnerId)
            .single();
        if (!partner)
            return null;
        const rel = Number(partner.reliability_score ?? 0);
        const farmers = Number(partner.current_active_farmers ?? 0);
        const current = String(partner.tier);
        const certified = thresholds.certified;
        const senior = thresholds.senior;
        const master = thresholds.master;
        let next = current;
        if (master &&
            rel >= Number(master.reliability ?? 90) &&
            farmers >= Number(master.farmers ?? 150)) {
            next = 'master';
        }
        else if (senior &&
            rel >= Number(senior.reliability ?? 85) &&
            farmers >= Number(senior.farmers ?? 50)) {
            next = 'senior';
        }
        else if (certified &&
            rel >= Number(certified.reliability ?? 75) &&
            farmers >= Number(certified.farmers ?? 10)) {
            next = 'certified';
        }
        if (next !== current) {
            await supabase.from('partners').update({ tier: next }).eq('id', partnerId);
        }
        return next;
    },
};
//# sourceMappingURL=partner-kpi.service.js.map