import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { pricingConfigService } from './pricing-config.service.js';
import { computeKpiScore, quarterlyBonusAmount } from './incentive-formulas.js';

function monthYearFromDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function quarterKeyFromMonth(monthYear: string) {
  const [y, m] = monthYear.split('-').map(Number);
  const q = Math.ceil(m / 3);
  return `${y}-Q${q}`;
}

type LedgerRow = {
  lead_id?: string | null;
  farmer_id?: string | null;
  commerce_quote_id?: string | null;
  commerce_order_id?: string | null;
  status?: string;
};

function computeCollectionEfficiency(rows: LedgerRow[]): number {
  const byQuote = new Map<string, Set<string>>();
  for (const r of rows) {
    const qid = r.commerce_quote_id ? String(r.commerce_quote_id) : null;
    if (!qid) continue;
    const set = byQuote.get(qid) ?? new Set<string>();
    set.add(String(r.status ?? 'quoted'));
    byQuote.set(qid, set);
  }
  if (!byQuote.size) return 100;
  let eligible = 0;
  let paid = 0;
  for (const statuses of byQuote.values()) {
    if (statuses.has('confirmed') || statuses.has('paid')) {
      eligible += 1;
      if (statuses.has('paid')) paid += 1;
    }
  }
  if (eligible === 0) return 100;
  return (paid / eligible) * 100;
}

async function computeRepeatCustomerMetrics(
  rows: LedgerRow[],
  monthStartIso: string
): Promise<{ count: number; score: number }> {
  const farmerIds = new Set<string>();
  for (const r of rows) {
    if (r.farmer_id) farmerIds.add(String(r.farmer_id));
  }
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))] as string[];
  if (leadIds.length && farmerIds.size < leadIds.length) {
    const { data: leads } = await supabase.from('leads').select('id, farmer_id').in('id', leadIds);
    for (const l of leads ?? []) {
      if (l.farmer_id) farmerIds.add(String(l.farmer_id));
    }
  }
  if (!farmerIds.size) return { count: 0, score: 0 };

  const { data: priorPaid } = await supabase
    .from('employee_sales_ledger')
    .select('farmer_id, lead_id')
    .in('status', ['paid', 'confirmed'])
    .lt('recorded_at', monthStartIso);
  const priorFarmers = new Set<string>();
  for (const r of priorPaid ?? []) {
    if (r.farmer_id) priorFarmers.add(String(r.farmer_id));
  }

  let repeatCount = 0;
  for (const fid of farmerIds) {
    if (priorFarmers.has(fid)) repeatCount += 1;
  }
  return { count: repeatCount, score: Math.min(5, repeatCount) };
}

async function computeReturnComplaintCount(
  rows: LedgerRow[],
  start: string,
  end: string
): Promise<number> {
  const ledgerReturns = rows.filter((r) => r.status === 'returned').length;
  const orderIds = [...new Set(rows.map((r) => r.commerce_order_id).filter(Boolean))] as string[];
  if (!orderIds.length) return ledgerReturns;

  const { count } = await supabase
    .from('shipment_exceptions')
    .select('id', { count: 'exact', head: true })
    .in('commerce_order_id', orderIds)
    .gte('created_at', start)
    .lte('created_at', end);
  return ledgerReturns + (count ?? 0);
}

export const employeeKpiService = {
  async recomputeMonthlyKpi(employeeProfileId: string, monthYear: string) {
    const config = await pricingConfigService.getConfig();
    const [y, m] = monthYear.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString();

    const { data: ledger, error } = await supabase
      .from('employee_sales_ledger')
      .select('*')
      .eq('employee_profile_id', employeeProfileId)
      .gte('recorded_at', start)
      .lte('recorded_at', end)
      .in('status', ['quoted', 'confirmed', 'paid']);
    throwIfSupabaseError(error, 'Load ledger for KPI');

    const rows = ledger ?? [];
    const salesVolume = rows.reduce((s, r) => s + Number(r.final_unit_price) * Number(r.qty), 0);
    const grossProfit = rows.reduce((s, r) => s + Number(r.gross_profit), 0);
    const incentive = rows.reduce((s, r) => s + Number(r.incentive_amount), 0);
    const weightedRealization =
      salesVolume > 0
        ? rows.reduce((s, r) => s + Number(r.realization_pct) * Number(r.final_unit_price) * Number(r.qty), 0) /
          salesVolume
        : 100;

    const target = config.monthlySalesTargetInr;
    const salesAchievementPct = target > 0 ? (salesVolume / target) * 100 : 0;

    const profitTarget = target * (config.targetGrossMarginPct / 100);
    const profitContributionScore =
      profitTarget > 0 ? Math.min(20, (grossProfit / profitTarget) * 20) : grossProfit > 0 ? 10 : 0;

    const repeatMetrics = await computeRepeatCustomerMetrics(rows, start);
    const collectionEfficiency = computeCollectionEfficiency(rows);
    const returnCount = await computeReturnComplaintCount(rows, start, end);

    const kpi = computeKpiScore({
      salesAchievementPct,
      avgRealizationPct: weightedRealization,
      profitContributionScore,
      repeatCustomersScore: repeatMetrics.score,
      collectionEfficiencyPct: collectionEfficiency,
      returnComplaintCount: returnCount,
    });

    const { data: profile } = await supabase
      .from('employee_profiles')
      .select('admin_user_id')
      .eq('id', employeeProfileId)
      .maybeSingle();

    const row = {
      employee_profile_id: employeeProfileId,
      admin_user_id: profile?.admin_user_id ?? null,
      month_year: monthYear,
      sales_volume_inr: Math.round(salesVolume * 100) / 100,
      sales_target_inr: target,
      sales_achievement_pct: Math.round(salesAchievementPct * 100) / 100,
      avg_realization_pct: Math.round(weightedRealization * 100) / 100,
      gross_profit_inr: Math.round(grossProfit * 100) / 100,
      net_profit_inr: Math.round(grossProfit * 100) / 100,
      incentive_earned_inr: Math.round(incentive * 100) / 100,
      repeat_customers: repeatMetrics.count,
      collection_efficiency_pct: Math.round(collectionEfficiency * 100) / 100,
      return_complaint_count: returnCount,
      score_sales: kpi.scoreSales,
      score_realization: kpi.scoreRealization,
      score_profit: kpi.scoreProfit,
      score_repeat: kpi.scoreRepeat,
      score_collection: kpi.scoreCollection,
      score_returns: kpi.scoreReturns,
      total_score: kpi.totalScore,
      grade: kpi.grade,
      computed_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from('employee_monthly_kpi_scores')
      .upsert(row, { onConflict: 'employee_profile_id,month_year' });
    throwIfSupabaseError(upsertErr, 'Upsert monthly KPI');

    await this.recomputeQuarterlyBonus(employeeProfileId, quarterKeyFromMonth(monthYear));

    return row;
  },

  async recomputeQuarterlyBonus(employeeProfileId: string, quarterKey: string) {
    const config = await pricingConfigService.getConfig();
    const [yearStr, qPart] = quarterKey.split('-Q');
    const year = Number(yearStr);
    const q = Number(qPart);
    const startMonth = (q - 1) * 3 + 1;
    const months = [startMonth, startMonth + 1, startMonth + 2].map(
      (m) => `${year}-${String(m).padStart(2, '0')}`
    );

    const { data: scores } = await supabase
      .from('employee_monthly_kpi_scores')
      .select('total_score, avg_realization_pct')
      .eq('employee_profile_id', employeeProfileId)
      .in('month_year', months);

    const list = scores ?? [];
    if (!list.length) return null;

    const avgScore = list.reduce((s, r) => s + Number(r.total_score), 0) / list.length;
    const avgRealization =
      list.reduce((s, r) => s + Number(r.avg_realization_pct), 0) / list.length;

    const bonus = quarterlyBonusAmount(avgScore, avgRealization, config);

    const row = {
      employee_profile_id: employeeProfileId,
      quarter_key: quarterKey,
      avg_monthly_score: Math.round(avgScore * 100) / 100,
      avg_realization_pct: Math.round(avgRealization * 100) / 100,
      grade: bonus.grade,
      bonus_amount: bonus.amount,
      bonus_eligible: bonus.eligible,
      status: bonus.eligible ? 'pending' : bonus.grade === 'Risk' ? 'blocked' : 'pending',
      notes: bonus.note,
      computed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('employee_quarterly_bonuses')
      .upsert(row, { onConflict: 'employee_profile_id,quarter_key' });
    throwIfSupabaseError(error, 'Upsert quarterly bonus');
    return row;
  },

  async getDashboard(monthYear?: string) {
    const my = monthYear ?? monthYearFromDate(new Date());
    const { data: scores, error } = await supabase
      .from('employee_monthly_kpi_scores')
      .select('*, employee_profiles(full_name, employee_code, admin_user_id)')
      .eq('month_year', my)
      .order('total_score', { ascending: false });
    throwIfSupabaseError(error, 'Load KPI dashboard');

    return {
      monthYear: my,
      employees: (scores ?? []).map((s) => {
        const prof = s.employee_profiles as { full_name?: string; employee_code?: string } | null;
        return {
          employeeProfileId: String(s.employee_profile_id),
          fullName: String(prof?.full_name ?? 'Unknown'),
          employeeCode: String(prof?.employee_code ?? '—'),
          salesVolumeInr: Number(s.sales_volume_inr) || 0,
          avgRealizationPct: Number(s.avg_realization_pct) || 0,
          grossProfitInr: Number(s.gross_profit_inr) || 0,
          netProfitInr: Number(s.net_profit_inr) || 0,
          incentiveEarnedInr: Number(s.incentive_earned_inr) || 0,
          totalScore: Number(s.total_score) || 0,
          grade: String(s.grade),
          salesAchievementPct: Number(s.sales_achievement_pct) || 0,
          profitLabel:
            Number(s.gross_profit_inr) >= 50000
              ? 'High'
              : Number(s.gross_profit_inr) >= 15000
                ? 'Moderate'
                : 'Weak',
        };
      }),
    };
  },

  async recomputeAllForMonth(monthYear?: string) {
    const my = monthYear ?? monthYearFromDate(new Date());
    const { data: profiles } = await supabase.from('employee_profiles').select('id').eq('status', 'active');
    for (const p of profiles ?? []) {
      await this.recomputeMonthlyKpi(String(p.id), my);
    }
  },
};
