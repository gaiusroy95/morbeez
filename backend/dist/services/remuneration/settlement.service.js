import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { periodMonth } from '../../domain/remuneration/agronomist-pay.js';
import { splitSettlement } from '../../domain/remuneration/settlement-split.js';
import { earningRulesService } from './earning-rules.service.js';
export const settlementService = {
    async createForEarning(input) {
        const gross = Math.round(Math.max(0, input.grossInr) * 100) / 100;
        if (gross <= 0)
            return;
        const { data: existing } = await supabase
            .from('earning_settlements')
            .select('id')
            .eq('earning_source', input.earningSource)
            .eq('earning_id', input.earningId)
            .limit(1)
            .maybeSingle();
        if (existing?.id)
            return;
        const rule = await earningRulesService.settlementRule();
        const parts = splitSettlement(gross, input.earningMonth, rule);
        for (const part of parts) {
            if (part.amountInr <= 0)
                continue;
            const { error } = await supabase.from('earning_settlements').insert({
                party_type: input.partyType,
                party_id: input.partyId,
                earning_source: input.earningSource,
                earning_id: input.earningId,
                earning_month: input.earningMonth,
                earning_type: input.earningType,
                gross_inr: gross,
                tranche: part.tranche,
                amount_inr: part.amountInr,
                payable_on: part.payableOn,
                final_payable_inr: part.amountInr,
                status: 'pending',
            });
            if (error && error.code !== '23505') {
                logger.warn({ err: error, earningId: input.earningId }, 'Could not create settlement tranche');
            }
        }
    },
    async dueForParty(partyType, partyId, asOf = new Date()) {
        const day = asOf.toISOString().slice(0, 10);
        const { data, error } = await supabase
            .from('earning_settlements')
            .select('*')
            .eq('party_type', partyType)
            .eq('party_id', partyId)
            .eq('status', 'pending')
            .eq('fraud_hold', false)
            .lte('payable_on', day)
            .is('payout_batch_id', null)
            .is('payroll_entry_id', null);
        if (error) {
            logger.warn({ err: error, partyId }, 'Could not load due settlements');
            return [];
        }
        return data ?? [];
    },
    async dueTotalInr(partyType, partyId, asOf = new Date()) {
        const rows = await this.dueForParty(partyType, partyId, asOf);
        return Math.round(rows.reduce((s, r) => s + Number(r.final_payable_inr ?? r.amount_inr ?? 0), 0) * 100) / 100;
    },
    async markPaid(ids, paymentReference) {
        if (!ids.length)
            return;
        await supabase
            .from('earning_settlements')
            .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_reference: paymentReference ?? null,
        })
            .in('id', ids);
    },
    async applyReturnRecovery(earningSource, earningId, recoverInr) {
        const amount = Math.round(Math.max(0, recoverInr) * 100) / 100;
        if (amount <= 0)
            return;
        const { data: rows } = await supabase
            .from('earning_settlements')
            .select('id, tranche, amount_inr, return_adjustment_inr, status, final_payable_inr')
            .eq('earning_source', earningSource)
            .eq('earning_id', earningId)
            .neq('status', 'cancelled');
        const twenty = (rows ?? []).find((r) => r.tranche === 'twenty');
        const eighty = (rows ?? []).find((r) => r.tranche === 'eighty');
        let remaining = amount;
        for (const row of [twenty, eighty]) {
            if (!row || remaining <= 0)
                continue;
            if (row.status === 'paid')
                continue;
            const current = Number(row.final_payable_inr ?? row.amount_inr ?? 0);
            const take = Math.min(current, remaining);
            remaining -= take;
            await supabase
                .from('earning_settlements')
                .update({
                return_adjustment_inr: Number(row.return_adjustment_inr ?? 0) + take,
                recovery_inr: take,
                final_payable_inr: Math.round((current - take) * 100) / 100,
            })
                .eq('id', row.id);
        }
        return { recovered: amount - remaining, futureRecovery: remaining };
    },
    async resyncPending(input) {
        const { data: rows } = await supabase
            .from('earning_settlements')
            .select('id, tranche, status')
            .eq('earning_source', input.earningSource)
            .eq('earning_id', input.earningId);
        if (!rows?.length) {
            await this.createForEarning(input);
            return;
        }
        if (rows.some((r) => r.status === 'paid' || r.status === 'approved'))
            return;
        const rule = await earningRulesService.settlementRule();
        const parts = splitSettlement(input.grossInr, input.earningMonth, rule);
        for (const part of parts) {
            const row = rows.find((r) => r.tranche === part.tranche);
            if (!row)
                continue;
            await supabase
                .from('earning_settlements')
                .update({
                gross_inr: Math.round(Math.max(0, input.grossInr) * 100) / 100,
                amount_inr: part.amountInr,
                final_payable_inr: part.amountInr,
                payable_on: part.payableOn,
            })
                .eq('id', row.id)
                .eq('status', 'pending');
        }
    },
    async attachPayoutBatch(ids, batchId) {
        if (!ids.length)
            return;
        await supabase.from('earning_settlements').update({ payout_batch_id: batchId }).in('id', ids);
    },
    async attachPayrollEntry(ids, payrollEntryId) {
        if (!ids.length)
            return;
        await supabase
            .from('earning_settlements')
            .update({ payroll_entry_id: payrollEntryId })
            .in('id', ids);
    },
    async dueUnattached(partyType, asOf = new Date()) {
        const day = asOf.toISOString().slice(0, 10);
        const { data, error } = await supabase
            .from('earning_settlements')
            .select('*')
            .eq('party_type', partyType)
            .eq('status', 'pending')
            .eq('fraud_hold', false)
            .lte('payable_on', day)
            .is('payout_batch_id', null)
            .is('payroll_entry_id', null);
        if (error) {
            logger.warn({ err: error, partyType }, 'Could not load unattached due settlements');
            return [];
        }
        return data ?? [];
    },
    currentMonthKey: periodMonth,
};
//# sourceMappingURL=settlement.service.js.map