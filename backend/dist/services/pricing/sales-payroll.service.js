import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { employeeKpiService } from './employee-kpi.service.js';
function monthBounds(year, month) {
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59)).toISOString();
    return { start, end };
}
export const salesPayrollService = {
    async getMonthlyTotals(employeeProfileId, year, month) {
        const monthYear = `${year}-${String(month).padStart(2, '0')}`;
        const { start, end } = monthBounds(year, month);
        const { data: ledger, error } = await supabase
            .from('employee_sales_ledger')
            .select('*')
            .eq('employee_profile_id', employeeProfileId)
            .gte('recorded_at', start)
            .lte('recorded_at', end)
            .in('status', ['quoted', 'confirmed', 'paid']);
        throwIfSupabaseError(error, 'Load sales ledger for payroll');
        const rows = ledger ?? [];
        const salesVolume = rows.reduce((s, r) => s + Number(r.final_unit_price) * Number(r.qty), 0);
        const grossProfit = rows.reduce((s, r) => s + Number(r.gross_profit), 0);
        const incentive = rows.reduce((s, r) => s + Number(r.incentive_amount), 0);
        const weightedRealization = salesVolume > 0
            ? rows.reduce((s, r) => s + Number(r.realization_pct) * Number(r.final_unit_price) * Number(r.qty), 0) /
                salesVolume
            : 100;
        const { data: kpi } = await supabase
            .from('employee_monthly_kpi_scores')
            .select('total_score, grade, sales_achievement_pct')
            .eq('employee_profile_id', employeeProfileId)
            .eq('month_year', monthYear)
            .maybeSingle();
        if (!kpi) {
            await employeeKpiService.recomputeMonthlyKpi(employeeProfileId, monthYear).catch(() => { });
        }
        const { data: kpiFresh } = await supabase
            .from('employee_monthly_kpi_scores')
            .select('total_score, grade, sales_achievement_pct')
            .eq('employee_profile_id', employeeProfileId)
            .eq('month_year', monthYear)
            .maybeSingle();
        const q = Math.ceil(month / 3);
        const quarterKey = `${year}-Q${q}`;
        let quarterlyBonusInr = 0;
        if (month % 3 === 0) {
            const { data: qb } = await supabase
                .from('employee_quarterly_bonuses')
                .select('bonus_amount, bonus_eligible')
                .eq('employee_profile_id', employeeProfileId)
                .eq('quarter_key', quarterKey)
                .maybeSingle();
            if (qb?.bonus_eligible)
                quarterlyBonusInr = Number(qb.bonus_amount) || 0;
        }
        const quoteIds = new Set(rows.map((r) => r.commerce_quote_id).filter(Boolean));
        return {
            employeeProfileId,
            salesVolumeInr: Math.round(salesVolume * 100) / 100,
            grossProfitInr: Math.round(grossProfit * 100) / 100,
            incentiveEarnedInr: Math.round(incentive * 100) / 100,
            avgRealizationPct: Math.round(weightedRealization * 100) / 100,
            salesAchievementPct: Number(kpiFresh?.sales_achievement_pct) || 0,
            quarterlyBonusInr,
            kpiGrade: kpiFresh?.grade ? String(kpiFresh.grade) : null,
            kpiScore: kpiFresh?.total_score != null ? Number(kpiFresh.total_score) : null,
            orderCount: quoteIds.size,
        };
    },
};
//# sourceMappingURL=sales-payroll.service.js.map