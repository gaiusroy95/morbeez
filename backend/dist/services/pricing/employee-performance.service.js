import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { pricingConfigService } from './pricing-config.service.js';
function statusFromRealization(avgPct, netProfit, config) {
    if (avgPct >= config.realizationExcellent && netProfit > 0)
        return 'excellent';
    if (avgPct >= config.realizationGood && netProfit > 0)
        return 'good';
    if (avgPct >= config.realizationWarning)
        return 'warning';
    return 'critical';
}
function nextActionStage(current, status) {
    if (status === 'excellent' || status === 'good')
        return 0;
    if (status === 'warning')
        return Math.min(2, current + 1);
    return Math.min(5, current + 1);
}
export const employeePerformanceService = {
    async recomputeDailySnapshot(employeeProfileId, date) {
        const dayStart = `${date}T00:00:00.000Z`;
        const dayEnd = `${date}T23:59:59.999Z`;
        const { data: ledger, error } = await supabase
            .from('employee_sales_ledger')
            .select('*')
            .eq('employee_profile_id', employeeProfileId)
            .gte('recorded_at', dayStart)
            .lte('recorded_at', dayEnd)
            .in('status', ['quoted', 'confirmed', 'paid']);
        throwIfSupabaseError(error, 'Load ledger for snapshot');
        const rows = ledger ?? [];
        const config = await pricingConfigService.getConfig();
        const salesVolume = rows.reduce((s, r) => s + Number(r.final_unit_price) * Number(r.qty), 0);
        const grossProfit = rows.reduce((s, r) => s + Number(r.gross_profit), 0);
        const netProfit = rows.reduce((s, r) => s + Number(r.net_profit), 0);
        const incentive = rows.reduce((s, r) => s + Number(r.incentive_amount), 0);
        const avgRealization = rows.length > 0
            ? rows.reduce((s, r) => s + Number(r.realization_pct), 0) / rows.length
            : 100;
        const { data: profile } = await supabase
            .from('employee_profiles')
            .select('admin_user_id, employee_compensation(pricing_access_restricted, performance_action_stage)')
            .eq('id', employeeProfileId)
            .maybeSingle();
        const comp = profile?.employee_compensation;
        const compRow = Array.isArray(comp) ? comp[0] : comp;
        const currentStage = Number(compRow?.performance_action_stage) || 0;
        let status = statusFromRealization(avgRealization, netProfit, config);
        if (compRow?.pricing_access_restricted)
            status = 'restricted';
        const actionStage = nextActionStage(currentStage, status);
        const snapshot = {
            employee_profile_id: employeeProfileId,
            admin_user_id: profile?.admin_user_id ?? null,
            snapshot_date: date,
            period: 'daily',
            sales_volume_inr: Math.round(salesVolume * 100) / 100,
            order_count: new Set(rows.map((r) => r.commerce_quote_id).filter(Boolean)).size,
            avg_realization_pct: Math.round(avgRealization * 100) / 100,
            gross_profit_inr: Math.round(grossProfit * 100) / 100,
            net_profit_inr: Math.round(netProfit * 100) / 100,
            incentive_earned_inr: Math.round(incentive * 100) / 100,
            repeat_customers: 0,
            return_count: rows.filter((r) => r.status === 'returned').length,
            performance_status: status,
            action_stage: actionStage,
            metadata: {},
        };
        const { error: snapErr } = await supabase
            .from('employee_performance_snapshots')
            .upsert(snapshot, { onConflict: 'employee_profile_id,snapshot_date,period' });
        throwIfSupabaseError(snapErr, 'Upsert performance snapshot');
        if (actionStage >= 3 && status === 'critical') {
            await supabase
                .from('employee_compensation')
                .update({
                pricing_access_restricted: actionStage >= 4,
                performance_action_stage: actionStage,
                updated_at: new Date().toISOString(),
            })
                .eq('employee_profile_id', employeeProfileId);
        }
        return snapshot;
    },
    async getDashboard(opts) {
        const date = opts?.date ?? new Date().toISOString().slice(0, 10);
        const period = opts?.period ?? 'daily';
        const { data: snapshots, error } = await supabase
            .from('employee_performance_snapshots')
            .select('*, employee_profiles(full_name, employee_code, admin_user_id)')
            .eq('snapshot_date', date)
            .eq('period', period)
            .order('net_profit_inr', { ascending: false });
        throwIfSupabaseError(error, 'Load performance dashboard');
        const rows = (snapshots ?? []).map((s) => {
            const prof = s.employee_profiles;
            return {
                employeeProfileId: String(s.employee_profile_id),
                adminUserId: prof?.admin_user_id ? String(prof.admin_user_id) : null,
                fullName: String(prof?.full_name ?? 'Unknown'),
                employeeCode: String(prof?.employee_code ?? '—'),
                salesVolumeInr: Number(s.sales_volume_inr) || 0,
                orderCount: Number(s.order_count) || 0,
                avgRealizationPct: Number(s.avg_realization_pct) || 0,
                grossProfitInr: Number(s.gross_profit_inr) || 0,
                netProfitInr: Number(s.net_profit_inr) || 0,
                incentiveEarnedInr: Number(s.incentive_earned_inr) || 0,
                repeatCustomers: Number(s.repeat_customers) || 0,
                returnCount: Number(s.return_count) || 0,
                status: String(s.performance_status),
                actionStage: Number(s.action_stage) || 0,
            };
        });
        return { date, period, employees: rows };
    },
    async getMyPerformance(adminUserId) {
        const { data: profile } = await supabase
            .from('employee_profiles')
            .select('id, full_name, employee_code')
            .eq('admin_user_id', adminUserId)
            .maybeSingle();
        if (!profile)
            return null;
        const today = new Date().toISOString().slice(0, 10);
        await this.recomputeDailySnapshot(String(profile.id), today);
        const { data: snap } = await supabase
            .from('employee_performance_snapshots')
            .select('*')
            .eq('employee_profile_id', profile.id)
            .eq('snapshot_date', today)
            .eq('period', 'daily')
            .maybeSingle();
        const config = await pricingConfigService.getConfig();
        return {
            fullName: profile.full_name,
            employeeCode: profile.employee_code,
            today: snap
                ? {
                    salesVolumeInr: Number(snap.sales_volume_inr),
                    avgRealizationPct: Number(snap.avg_realization_pct),
                    grossProfitInr: Number(snap.gross_profit_inr),
                    netProfitInr: Number(snap.net_profit_inr),
                    incentiveEarnedInr: Number(snap.incentive_earned_inr),
                    status: snap.performance_status,
                    actionStage: Number(snap.action_stage),
                }
                : null,
            thresholds: {
                excellent: config.realizationExcellent,
                good: config.realizationGood,
                warning: config.realizationWarning,
            },
        };
    },
};
//# sourceMappingURL=employee-performance.service.js.map