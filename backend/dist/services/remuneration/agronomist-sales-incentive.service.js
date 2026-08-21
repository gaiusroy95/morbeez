import { supabase } from '../../lib/supabase.js';
import { periodMonth } from '../../domain/remuneration/agronomist-pay.js';
import { monthLastDay } from '../../domain/remuneration/rule-workflow.js';
import { agronomistPoolInr, agronomistSalesIncentiveInr, agronomistUnlockPct, } from '../../domain/remuneration/kpi-factor.js';
import { resolvePoolSplit } from '../../domain/remuneration/pool-split.js';
import { earningRulesService } from './earning-rules.service.js';
import { agronomistEarningsService } from './agronomist-earnings.service.js';
import { settlementService } from './settlement.service.js';
function monthRange(month) {
    const [y, m] = month.split('-').map(Number);
    const start = `${month}-01`;
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return { start, next };
}
async function poolFromLines(orderId) {
    const { data: lines } = await supabase
        .from('commerce_order_lines')
        .select('qty_ordered, unit_price, channel_pool_pct, channel_pool_agronomist_pct, channel_pool_partner_pct')
        .eq('commerce_order_id', orderId);
    let eligibleSales = 0;
    let poolInr = 0;
    for (const line of lines ?? []) {
        const sales = Number(line.qty_ordered ?? 0) * Number(line.unit_price ?? 0);
        eligibleSales += sales;
        const split = resolvePoolSplit({
            poolPct: Number(line.channel_pool_pct ?? 0),
            agronomistMaxPct: line.channel_pool_agronomist_pct == null ? null : Number(line.channel_pool_agronomist_pct),
            partnerMaxPct: line.channel_pool_partner_pct == null ? null : Number(line.channel_pool_partner_pct),
        });
        poolInr += agronomistPoolInr({
            eligibleItemInr: sales,
            agronomistPoolPct: split.agronomistMaxPct,
        });
    }
    return { eligibleSales, poolInr: Math.round(poolInr * 100) / 100 };
}
async function monthEligibleTotals(agronomistEmail, month) {
    const { start, next } = monthRange(month);
    const { data: orders } = await supabase
        .from('commerce_orders')
        .select('id, total_amount')
        .ilike('attributed_agronomist_email', agronomistEmail.trim())
        .eq('incentive_eligibility', 'eligible')
        .gte('incentive_eligible_at', `${start}T00:00:00.000Z`)
        .lt('incentive_eligible_at', `${next}T00:00:00.000Z`);
    let eligibleSales = 0;
    let poolInr = 0;
    for (const order of orders ?? []) {
        const extra = await poolFromLines(String(order.id));
        eligibleSales += extra.eligibleSales || Number(order.total_amount ?? 0);
        poolInr += extra.poolInr;
    }
    return { eligibleSales, poolInr: Math.round(poolInr * 100) / 100 };
}
export const agronomistSalesIncentiveService = {
    async accrueForOrder(input) {
        const email = input.agronomistEmail.trim();
        if (!email)
            return null;
        const profileId = await agronomistEarningsService.resolveEmployeeId(email);
        if (!profileId)
            return null;
        const month = input.periodMonth ?? periodMonth();
        const sourceId = `sales:${email.toLowerCase()}:${month}`;
        const { data: existing } = await supabase
            .from('agronomist_earnings_ledger')
            .select('id, amount_inr, status, employee_profile_id, period_month')
            .eq('event_type', 'sales_incentive')
            .eq('source_id', sourceId)
            .maybeSingle();
        if (existing?.status && existing.status !== 'pending')
            return existing;
        const stats = await monthEligibleTotals(email, month);
        const slabs = await earningRulesService.agronomistSlabs(monthLastDay(month));
        const unlock = agronomistUnlockPct(stats.eligibleSales || input.grossInr, slabs);
        const amount = agronomistSalesIncentiveInr(stats.poolInr, unlock);
        const notes = `Eligible sales ₹${Math.round(stats.eligibleSales || input.grossInr)} · unlock ${unlock}%`;
        const snapshot = { unlockPct: unlock, monthSales: stats.eligibleSales, poolInr: stats.poolInr };
        if (existing?.id) {
            await supabase
                .from('agronomist_earnings_ledger')
                .update({
                amount_inr: amount,
                order_id: input.orderId,
                notes,
                rate_snapshot: snapshot,
            })
                .eq('id', existing.id)
                .eq('status', 'pending');
            await settlementService.resyncPending({
                partyType: 'employee',
                partyId: String(existing.employee_profile_id ?? profileId),
                earningSource: 'agronomist_ledger',
                earningId: String(existing.id),
                earningMonth: String(existing.period_month ?? month),
                earningType: 'sales_incentive',
                grossInr: amount,
            });
            return { id: String(existing.id), amountInr: amount };
        }
        if (amount <= 0)
            return null;
        const credited = await agronomistEarningsService.credit({
            agronomistEmail: email,
            farmerId: input.farmerId,
            eventType: 'sales_incentive',
            sourceId,
            amountInr: amount,
            notes,
        });
        if (!credited?.id)
            return null;
        await supabase
            .from('agronomist_earnings_ledger')
            .update({ order_id: input.orderId, rate_snapshot: snapshot })
            .eq('id', credited.id);
        await settlementService.createForEarning({
            partyType: 'employee',
            partyId: profileId,
            earningSource: 'agronomist_ledger',
            earningId: credited.id,
            earningMonth: month,
            earningType: 'sales_incentive',
            grossInr: credited.amountInr,
        });
        return credited;
    },
    async adjustOrder(orderId, reason) {
        const { data: order } = await supabase
            .from('commerce_orders')
            .select('attributed_agronomist_email, farmer_id, incentive_eligible_at, total_amount')
            .eq('id', orderId)
            .maybeSingle();
        const email = order?.attributed_agronomist_email ? String(order.attributed_agronomist_email).trim() : '';
        if (!email)
            return { adjusted: 0 };
        const eligibleAt = order?.incentive_eligible_at ? String(order.incentive_eligible_at) : '';
        const month = eligibleAt ? eligibleAt.slice(0, 7) : periodMonth();
        const sourceId = `sales:${email.toLowerCase()}:${month}`;
        const { data: existing } = await supabase
            .from('agronomist_earnings_ledger')
            .select('id, amount_inr, status, employee_profile_id, period_month')
            .eq('event_type', 'sales_incentive')
            .eq('source_id', sourceId)
            .maybeSingle();
        if (!existing?.id)
            return { adjusted: 0 };
        if (existing.status === 'pending') {
            await this.accrueForOrder({
                agronomistEmail: email,
                farmerId: order?.farmer_id ? String(order.farmer_id) : '',
                orderId,
                grossInr: Number(order?.total_amount ?? 0),
                periodMonth: month,
            });
            return { adjusted: 1 };
        }
        const stats = await monthEligibleTotals(email, month);
        const slabs = await earningRulesService.agronomistSlabs(monthLastDay(month));
        const unlock = agronomistUnlockPct(stats.eligibleSales, slabs);
        const newAmount = agronomistSalesIncentiveInr(stats.poolInr, unlock);
        const delta = Math.round((Number(existing.amount_inr ?? 0) - newAmount) * 100) / 100;
        if (delta <= 0)
            return { adjusted: 0 };
        await agronomistEarningsService.credit({
            agronomistEmail: email,
            farmerId: order?.farmer_id ? String(order.farmer_id) : null,
            eventType: 'sales_adjustment',
            sourceId: `adj:${existing.id}:${orderId}`,
            amountInr: -delta,
            notes: reason,
        });
        await supabase
            .from('agronomist_earnings_ledger')
            .update({ parent_earning_id: existing.id, order_id: orderId })
            .eq('event_type', 'sales_adjustment')
            .eq('source_id', `adj:${existing.id}:${orderId}`);
        await settlementService.applyReturnRecovery('agronomist_ledger', String(existing.id), delta);
        return { adjusted: 1 };
    },
};
//# sourceMappingURL=agronomist-sales-incentive.service.js.map