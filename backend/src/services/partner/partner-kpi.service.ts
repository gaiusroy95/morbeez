import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { partnerSettingsService } from './partner-settings.service.js';

export const partnerKpiService = {
  async computeMonthlySnapshot(partnerId: string, periodStart: Date, periodEnd: Date) {
    const start = periodStart.toISOString();
    const end = periodEnd.toISOString();

    const { count: farmerGrowth } = await supabase
      .from('partner_farmer_attribution')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partnerId)
      .eq('attribution_type', 'enrollment')
      .gte('first_touch_at', start)
      .lte('first_touch_at', end);

    const { count: visits } = await supabase
      .from('crm_field_findings')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partnerId)
      .gte('created_at', start)
      .lte('created_at', end);

    const { count: tasksTotal } = await supabase
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_partner_id', partnerId)
      .gte('created_at', start)
      .lte('created_at', end);

    const { count: tasksDone } = await supabase
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_partner_id', partnerId)
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end);

    const visitCompletionPct =
      (tasksTotal ?? 0) > 0 ? Math.round(((tasksDone ?? 0) / (tasksTotal ?? 1)) * 100) : 0;

    const { data: partner } = await supabase
      .from('partners')
      .select('reliability_score, performance_score, current_active_farmers')
      .eq('id', partnerId)
      .single();

    const performanceScore = Math.min(
      100,
      Math.round(
        (Number(partner?.reliability_score ?? 70) * 0.4 +
          visitCompletionPct * 0.3 +
          Math.min(100, (farmerGrowth ?? 0) * 5) * 0.3) *
          10
      ) / 10
    );

    const row = {
      partner_id: partnerId,
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      farmer_growth: farmerGrowth ?? 0,
      farmer_retention_pct: 0,
      visit_completion_pct: visitCompletionPct,
      data_quality_pct: visitCompletionPct,
      recommendation_success_pct: 0,
      revenue_influence_inr: 0,
      lead_generation_count: farmerGrowth ?? 0,
      reliability_score: Number(partner?.reliability_score ?? 70),
      performance_score: performanceScore,
      metadata: { visits: visits ?? 0 },
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

  async maybePromoteTier(partnerId: string) {
    const thresholds = await partnerSettingsService.get('tier_thresholds');
    const { data: partner } = await supabase
      .from('partners')
      .select('tier, reliability_score, current_active_farmers')
      .eq('id', partnerId)
      .single();
    if (!partner) return null;

    const rel = Number(partner.reliability_score ?? 0);
    const farmers = Number(partner.current_active_farmers ?? 0);
    const current = String(partner.tier);

    const certified = thresholds.certified as { reliability?: number; farmers?: number } | undefined;
    const senior = thresholds.senior as { reliability?: number; farmers?: number } | undefined;
    const master = thresholds.master as { reliability?: number; farmers?: number } | undefined;

    let next = current;
    if (
      master &&
      rel >= Number(master.reliability ?? 90) &&
      farmers >= Number(master.farmers ?? 150)
    ) {
      next = 'master';
    } else if (
      senior &&
      rel >= Number(senior.reliability ?? 85) &&
      farmers >= Number(senior.farmers ?? 50)
    ) {
      next = 'senior';
    } else if (
      certified &&
      rel >= Number(certified.reliability ?? 75) &&
      farmers >= Number(certified.farmers ?? 10)
    ) {
      next = 'certified';
    }

    if (next !== current) {
      await supabase.from('partners').update({ tier: next }).eq('id', partnerId);
    }
    return next;
  },
};
