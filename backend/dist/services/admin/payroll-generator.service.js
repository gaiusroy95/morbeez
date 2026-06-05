import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { attendanceCalculatorService } from './attendance-calculator.service.js';
import { salesPayrollService } from '../pricing/sales-payroll.service.js';
export const payrollGeneratorService = {
    async generateCycle(year, month, actorId) {
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
            const kmAllowance = comp?.km_allowance_enabled ? Number(comp?.rate_per_km ?? 0) * 100 : 0;
            const travelAllowance = Number(comp?.travel_allowance ?? 0);
            const allowances = travelAllowance + kmAllowance;
            const sales = await salesPayrollService.getMonthlyTotals(employeeId, year, month);
            const salesIncentive = sales.incentiveEarnedInr;
            const quarterlyBonus = sales.quarterlyBonusInr;
            const totalIncentive = salesIncentive + quarterlyBonus;
            const deductions = summary.salary_eligibility ? 0 : fixedSalary * 0.15;
            const finalSalary = fixedSalary + allowances + totalIncentive - deductions;
            const { error: entryErr } = await supabase.from('payroll_entries').upsert({
                payroll_cycle_id: cycle.id,
                employee_profile_id: employeeId,
                fixed_salary: fixedSalary,
                estimated_incentive: salesIncentive,
                bonuses: quarterlyBonus,
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
                        totalIncentiveInr: totalIncentive,
                    },
                },
                updated_at: new Date().toISOString(),
            });
            throwIfSupabaseError(entryErr, 'Could not upsert payroll entry');
        }
        return cycle;
    },
    async publishPayrollEntry(payrollEntryId, actorId) {
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
    async deliverPayout(payrollEntryId, channels) {
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
//# sourceMappingURL=payroll-generator.service.js.map