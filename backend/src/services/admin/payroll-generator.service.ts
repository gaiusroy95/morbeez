import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { attendanceCalculatorService } from './attendance-calculator.service.js';
import { salesPayrollService } from '../pricing/sales-payroll.service.js';

export const payrollGeneratorService = {
  async generateCycle(year: number, month: number, actorId?: string) {
    const { data: cycle, error: cycleErr } = await supabase
      .from('payroll_cycles')
      .upsert({
        year,
        month,
        status: 'draft',
        run_date: new Date().toISOString(),
        created_by: actorId ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(cycleErr, 'Could not create payroll cycle');

    const { data: employees, error: empErr } = await supabase
      .from('employee_profiles')
      .select('id')
      .eq('status', 'active');
    throwIfSupabaseError(empErr, 'Could not load employees for payroll');

    for (const row of employees ?? []) {
      const employeeId = String(row.id);
      const summary = await attendanceCalculatorService.summarizeMonth(employeeId, year, month);
      const { data: comp } = await supabase
        .from('employee_compensation')
        .select('*')
        .eq('employee_profile_id', employeeId)
        .maybeSingle();
      const fixedSalary = Number(comp?.fixed_salary ?? 30000);
      const travelAllowance = Number(comp?.travel_allowance ?? 0);
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const { agronomistEarningsService } = await import(
        '../remuneration/agronomist-earnings.service.js'
      );
      const agro = await agronomistEarningsService.monthTotals(employeeId, monthKey);
      const kmAllowance = agro.kmInr;
      const allowances = travelAllowance + kmAllowance;

      const sales = await salesPayrollService.getMonthlyTotals(employeeId, year, month);
      const salesIncentive = sales.incentiveEarnedInr;
      const quarterlyBonus = sales.quarterlyBonusInr;
      const agronomistBonus = agro.bonusTotal;
      const totalIncentive = salesIncentive + quarterlyBonus + agronomistBonus;

      const deductions = summary.salary_eligibility ? 0 : fixedSalary * 0.15;
      const finalSalary = fixedSalary + allowances + totalIncentive - deductions;

      const { data: entry, error: entryErr } = await supabase.from('payroll_entries').upsert({
        payroll_cycle_id: cycle.id,
        employee_profile_id: employeeId,
        fixed_salary: fixedSalary,
        estimated_incentive: salesIncentive,
        bonuses: quarterlyBonus + agronomistBonus,
        km_allowance: allowances,
        deductions,
        final_salary: finalSalary,
        details: {
          attendance: {
            fullDays: summary.full_days,
            halfDays: summary.half_days,
            absentDays: summary.absent_days,
            workedDays: summary.worked_days,
            salaryEligibility: summary.salary_eligibility,
          },
          sales: {
            salesVolumeInr: sales.salesVolumeInr,
            grossProfitInr: sales.grossProfitInr,
            avgRealizationPct: sales.avgRealizationPct,
            salesAchievementPct: sales.salesAchievementPct,
            orderCount: sales.orderCount,
            kpiGrade: sales.kpiGrade,
            kpiScore: sales.kpiScore,
          },
          incentive: {
            salesIncentiveInr: salesIncentive,
            quarterlyBonusInr: quarterlyBonus,
            agronomistBonusInr: agronomistBonus,
            visitBonusInr: agro.visitBonus,
            recSuccessBonusInr: agro.recBonus,
            escalationBonusInr: agro.escalationBonus,
            retentionBonusInr: agro.retentionBonus,
            kmInr: agro.kmInr,
            kmTotal: agro.kmTotal,
            totalIncentiveInr: totalIncentive,
          },
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'payroll_cycle_id,employee_profile_id' })
        .select('id')
        .maybeSingle();
      throwIfSupabaseError(entryErr, 'Could not upsert payroll entry');
      if (entry?.id) {
        await agronomistEarningsService.markIncludedInPayroll(employeeId, monthKey, String(entry.id));
      }
    }

    return cycle;
  },

  async publishPayrollEntry(payrollEntryId: string, actorId?: string) {
    const pdfUrl = `payroll/${payrollEntryId}.pdf`;
    const { data, error } = await supabase
      .from('payroll_pdfs')
      .insert({
        payroll_entry_id: payrollEntryId,
        storage_url: pdfUrl,
        generated_by: actorId ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not generate payroll PDF');
    return data;
  },

  async deliverPayout(payrollEntryId: string, channels: Array<'whatsapp' | 'email' | 'dashboard'>) {
    for (const channel of channels) {
      await supabase.from('payout_delivery_logs').insert({
        payroll_entry_id: payrollEntryId,
        channel,
        delivery_status: 'sent',
        delivered_at: new Date().toISOString(),
      });
    }
    return { ok: true };
  },
};
