import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { pricingConfigService } from './pricing-config.service.js';
import { employeeKpiService } from './employee-kpi.service.js';

export type MonthlyEarningsRow = {
  monthYear: string;
  salesVolumeInr: number;
  salesTargetInr: number;
  salesAchievementPct: number;
  grossProfitInr: number;
  incentiveEarnedInr: number;
  fixedSalaryInr: number;
  quarterlyBonusInr: number;
  totalEarningsInr: number;
  totalScore: number;
  grade: string;
  avgRealizationPct: number;
  fromPayroll: boolean;
};

export type SalesLedgerRow = {
  id: string;
  recordedAt: string;
  productTitle: string | null;
  sku: string | null;
  qty: number;
  finalUnitPrice: number;
  incentiveAmount: number;
  grossProfit: number;
  retailOrBulk: string | null;
  status: string;
  quoteNumber: string | null;
};

function monthYearFromDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(monthYearFromDate(d));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

function quarterKeyFromMonth(monthYear: string) {
  const [y, m] = monthYear.split('-').map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export const employeeEarningsService = {
  async getMyEarnings(adminUserId: string) {
    const { data: profile, error: profErr } = await supabase
      .from('employee_profiles')
      .select('id, full_name, employee_code, role, status, state, district')
      .eq('admin_user_id', adminUserId)
      .maybeSingle();
    throwIfSupabaseError(profErr, 'Load employee profile');
    if (!profile) return null;

    const employeeProfileId = String(profile.id);
    const config = await pricingConfigService.getConfig();
    const currentMonth = monthYearFromDate(new Date());

    const { data: comp } = await supabase
      .from('employee_compensation')
      .select('fixed_salary, monthly_sales_target, incentive_enabled, travel_allowance')
      .eq('employee_profile_id', employeeProfileId)
      .maybeSingle();

    const fixedSalary = Number(comp?.fixed_salary) || 30000;
    const salesTarget = Number(comp?.monthly_sales_target) || config.monthlySalesTargetInr;

    let { data: kpiRows } = await supabase
      .from('employee_monthly_kpi_scores')
      .select('*')
      .eq('employee_profile_id', employeeProfileId)
      .order('month_year', { ascending: false })
      .limit(12);

    if (!kpiRows?.some((r) => r.month_year === currentMonth)) {
      await employeeKpiService.recomputeMonthlyKpi(employeeProfileId, currentMonth).catch(() => {});
      const { data: refreshed } = await supabase
        .from('employee_monthly_kpi_scores')
        .select('*')
        .eq('employee_profile_id', employeeProfileId)
        .order('month_year', { ascending: false })
        .limit(12);
      kpiRows = refreshed ?? kpiRows;
    }

    const months = lastNMonths(12);
    const { data: payrollRows } = await supabase
      .from('payroll_entries')
      .select('*, payroll_cycles(year, month)')
      .eq('employee_profile_id', employeeProfileId)
      .order('created_at', { ascending: false })
      .limit(12);

    const payrollByMonth = new Map<string, (typeof payrollRows extends (infer T)[] | null ? T : never)>();
    for (const p of payrollRows ?? []) {
      const cycle = p.payroll_cycles as { year?: number; month?: number } | null;
      if (cycle?.year && cycle?.month) {
        const key = `${cycle.year}-${String(cycle.month).padStart(2, '0')}`;
        payrollByMonth.set(key, p);
      }
    }

    const kpiByMonth = new Map((kpiRows ?? []).map((r) => [String(r.month_year), r]));

    const quarterlyBonusByMonth = new Map<string, number>();
    for (const my of months) {
      const qk = quarterKeyFromMonth(my);
      const { data: qb } = await supabase
        .from('employee_quarterly_bonuses')
        .select('bonus_amount, bonus_eligible, quarter_key')
        .eq('employee_profile_id', employeeProfileId)
        .eq('quarter_key', qk)
        .maybeSingle();
      const monthNum = Number(my.split('-')[1]);
      if (monthNum % 3 === 0 && qb?.bonus_eligible) {
        quarterlyBonusByMonth.set(my, Number(qb.bonus_amount) || 0);
      }
    }

    const monthlyHistory: MonthlyEarningsRow[] = months.map((my) => {
      const kpi = kpiByMonth.get(my);
      const payroll = payrollByMonth.get(my);
      const incentive = payroll
        ? Number(payroll.estimated_incentive) || 0
        : Number(kpi?.incentive_earned_inr) || 0;
      const bonus = payroll ? Number(payroll.bonuses) || 0 : quarterlyBonusByMonth.get(my) ?? 0;
      const salary = payroll ? Number(payroll.fixed_salary) || fixedSalary : fixedSalary;

      return {
        monthYear: my,
        salesVolumeInr: Number(kpi?.sales_volume_inr) || 0,
        salesTargetInr: Number(kpi?.sales_target_inr) || salesTarget,
        salesAchievementPct: Number(kpi?.sales_achievement_pct) || 0,
        grossProfitInr: Number(kpi?.gross_profit_inr) || 0,
        incentiveEarnedInr: incentive,
        fixedSalaryInr: salary,
        quarterlyBonusInr: bonus,
        totalEarningsInr: salary + incentive + bonus,
        totalScore: Number(kpi?.total_score) || 0,
        grade: String(kpi?.grade ?? '—'),
        avgRealizationPct: Number(kpi?.avg_realization_pct) || 0,
        fromPayroll: Boolean(payroll),
      };
    });

    const current = monthlyHistory.find((m) => m.monthYear === currentMonth) ?? monthlyHistory[0];

    const { data: ledger, error: ledErr } = await supabase
      .from('employee_sales_ledger')
      .select('*, commerce_quotes(quote_number)')
      .eq('employee_profile_id', employeeProfileId)
      .order('recorded_at', { ascending: false })
      .limit(40);
    throwIfSupabaseError(ledErr, 'Load sales ledger');

    const recentSales: SalesLedgerRow[] = (ledger ?? []).map((r) => {
      const quote = r.commerce_quotes as { quote_number?: string } | null;
      return {
        id: String(r.id),
        recordedAt: String(r.recorded_at),
        productTitle: r.product_title ? String(r.product_title) : null,
        sku: r.sku ? String(r.sku) : null,
        qty: Number(r.qty) || 0,
        finalUnitPrice: Number(r.final_unit_price) || 0,
        incentiveAmount: Number(r.incentive_amount) || 0,
        grossProfit: Number(r.gross_profit) || 0,
        retailOrBulk: r.retail_or_bulk ? String(r.retail_or_bulk) : null,
        status: String(r.status),
        quoteNumber: quote?.quote_number ? String(quote.quote_number) : null,
      };
    });

    return {
      profile: {
        fullName: String(profile.full_name ?? ''),
        employeeCode: String(profile.employee_code ?? ''),
        role: String(profile.role ?? ''),
        status: String(profile.status ?? ''),
        state: profile.state ? String(profile.state) : null,
        district: profile.district ? String(profile.district) : null,
      },
      compensation: {
        fixedSalaryInr: fixedSalary,
        monthlySalesTargetInr: salesTarget,
        incentiveEnabled: comp?.incentive_enabled !== false,
        travelAllowanceInr: Number(comp?.travel_allowance) || 0,
      },
      currentMonth: current ?? null,
      monthlyHistory,
      recentSales,
      config: {
        monthlySalesTargetInr: config.monthlySalesTargetInr,
        bulkOrderThresholdInr: config.bulkOrderThresholdInr,
      },
    };
  },
};
