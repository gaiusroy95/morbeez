import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { logger } from '../../lib/logger.js';
import { amountForEvent, periodMonth, } from '../../domain/remuneration/agronomist-pay.js';
import { haversineKm } from '../../domain/remuneration/km.js';
async function resolveProfile(email) {
    const normalised = email.trim().toLowerCase();
    if (!normalised)
        return null;
    const { data: byEmail } = await supabase
        .from('employee_profiles')
        .select('id, email, role, admin_user_id')
        .ilike('email', normalised)
        .maybeSingle();
    if (byEmail?.id)
        return byEmail;
    const { data: admin } = await supabase
        .from('admin_users')
        .select('id')
        .ilike('email', normalised)
        .maybeSingle();
    if (!admin?.id)
        return null;
    const { data: byAdmin } = await supabase
        .from('employee_profiles')
        .select('id, email, role, admin_user_id')
        .eq('admin_user_id', admin.id)
        .maybeSingle();
    return byAdmin ?? null;
}
async function loadComp(employeeProfileId) {
    const { data } = await supabase
        .from('employee_compensation')
        .select('incentive_enabled, field_visit_bonus, recommendation_success_bonus, escalation_bonus, farmer_retention_bonus, km_allowance_enabled, rate_per_km')
        .eq('employee_profile_id', employeeProfileId)
        .maybeSingle();
    return {
        incentiveEnabled: data?.incentive_enabled !== false,
        fieldVisitBonus: Number(data?.field_visit_bonus ?? 0),
        recommendationSuccessBonus: Number(data?.recommendation_success_bonus ?? 0),
        escalationBonus: Number(data?.escalation_bonus ?? 0),
        farmerRetentionBonus: Number(data?.farmer_retention_bonus ?? 0),
        kmAllowanceEnabled: Boolean(data?.km_allowance_enabled),
        ratePerKm: Number(data?.rate_per_km ?? 0),
    };
}
export const agronomistEarningsService = {
    async resolveEmployeeId(email) {
        const profile = await resolveProfile(email);
        return profile?.id ? String(profile.id) : null;
    },
    async credit(input) {
        const profile = await resolveProfile(input.agronomistEmail);
        if (!profile?.id) {
            logger.info({ email: input.agronomistEmail, type: input.eventType }, 'Agronomist pay skipped — no employee profile');
            return null;
        }
        const { data: existing } = await supabase
            .from('agronomist_earnings_ledger')
            .select('id, amount_inr')
            .eq('event_type', input.eventType)
            .eq('source_id', input.sourceId)
            .maybeSingle();
        if (existing?.id) {
            return { id: String(existing.id), amountInr: Number(existing.amount_inr) };
        }
        const comp = await loadComp(String(profile.id));
        const amount = input.amountInr != null
            ? Math.round(input.amountInr * 100) / 100
            : amountForEvent(input.eventType, comp, { km: input.km ?? 0 });
        if (input.amountInr == null && amount <= 0)
            return null;
        const { data, error } = await supabase
            .from('agronomist_earnings_ledger')
            .insert({
            employee_profile_id: profile.id,
            agronomist_email: String(profile.email ?? input.agronomistEmail),
            farmer_id: input.farmerId ?? null,
            event_type: input.eventType,
            source_id: input.sourceId,
            amount_inr: amount,
            km: input.km ?? null,
            rate_snapshot: comp,
            period_month: periodMonth(),
            status: 'pending',
            notes: input.notes ?? null,
        })
            .select('id, amount_inr')
            .maybeSingle();
        if (error?.code === '23505') {
            const { data: again } = await supabase
                .from('agronomist_earnings_ledger')
                .select('id, amount_inr')
                .eq('event_type', input.eventType)
                .eq('source_id', input.sourceId)
                .maybeSingle();
            if (again?.id)
                return { id: String(again.id), amountInr: Number(again.amount_inr) };
        }
        throwIfSupabaseError(error, 'Could not credit agronomist earning');
        if (!data?.id)
            return null;
        return { id: String(data.id), amountInr: Number(data.amount_inr) };
    },
    async creditVisitCheckout(session) {
        const sourceId = session.field_finding_id
            ? `finding:${session.field_finding_id}`
            : `session:${session.id}`;
        await this.credit({
            agronomistEmail: session.agronomist_email,
            farmerId: session.farmer_id,
            eventType: 'field_visit',
            sourceId,
            notes: 'Field visit checkout',
        });
        const km = haversineKm({ lat: session.check_in_lat, lng: session.check_in_lng }, { lat: session.check_out_lat, lng: session.check_out_lng });
        if (km != null) {
            await this.credit({
                agronomistEmail: session.agronomist_email,
                farmerId: session.farmer_id,
                eventType: 'km_allowance',
                sourceId: `km:${session.id}`,
                km,
                notes: `${km} km GPS checkout`,
            });
        }
    },
    async monthTotals(employeeProfileId, period) {
        const { data, error } = await supabase
            .from('agronomist_earnings_ledger')
            .select('event_type, amount_inr, km, status')
            .eq('employee_profile_id', employeeProfileId)
            .eq('period_month', period)
            .neq('status', 'reversed');
        throwIfSupabaseError(error, 'Could not load agronomist earnings');
        const rows = data ?? [];
        const visitBonus = rows
            .filter((r) => r.event_type === 'field_visit')
            .reduce((s, r) => s + Number(r.amount_inr), 0);
        const recBonus = rows
            .filter((r) => r.event_type === 'recommendation_success')
            .reduce((s, r) => s + Number(r.amount_inr), 0);
        const escalationBonus = rows
            .filter((r) => r.event_type === 'escalation_resolved')
            .reduce((s, r) => s + Number(r.amount_inr), 0);
        const retentionBonus = rows
            .filter((r) => r.event_type === 'retention')
            .reduce((s, r) => s + Number(r.amount_inr), 0);
        const kmRows = rows.filter((r) => r.event_type === 'km_allowance');
        const kmInr = kmRows.reduce((s, r) => s + Number(r.amount_inr), 0);
        const kmTotal = kmRows.reduce((s, r) => s + Number(r.km ?? 0), 0);
        const bonusTotal = visitBonus + recBonus + escalationBonus + retentionBonus;
        const salesIncentive = rows
            .filter((r) => r.event_type === 'sales_incentive' || r.event_type === 'sales_adjustment')
            .reduce((s, r) => s + Number(r.amount_inr), 0);
        return {
            visitBonus,
            recBonus,
            escalationBonus,
            retentionBonus,
            kmInr,
            kmTotal: Math.round(kmTotal * 100) / 100,
            bonusTotal: Math.round(bonusTotal * 100) / 100,
            salesIncentive: Math.round(salesIncentive * 100) / 100,
            eventCount: rows.length,
        };
    },
    async markIncludedInPayroll(employeeProfileId, period, payrollEntryId) {
        await supabase
            .from('agronomist_earnings_ledger')
            .update({ status: 'included_in_payroll', payroll_entry_id: payrollEntryId })
            .eq('employee_profile_id', employeeProfileId)
            .eq('period_month', period)
            .eq('status', 'pending')
            .in('event_type', [
            'field_visit',
            'km_allowance',
            'recommendation_success',
            'escalation_resolved',
            'retention',
        ]);
    },
    async listForEmployee(employeeProfileId, limit = 40) {
        const { data, error } = await supabase
            .from('agronomist_earnings_ledger')
            .select('id, event_type, amount_inr, km, status, period_month, notes, created_at, source_id')
            .eq('employee_profile_id', employeeProfileId)
            .order('created_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Could not list agronomist earnings');
        return data ?? [];
    },
};
//# sourceMappingURL=agronomist-earnings.service.js.map