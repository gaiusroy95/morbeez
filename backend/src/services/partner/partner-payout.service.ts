import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ValidationError } from '../../lib/errors.js';
import { periodMonth } from '../../domain/remuneration/agronomist-pay.js';

function payableAmount(row: { commission_inr?: unknown; bonus_inr?: unknown; reliability_hold_pct?: unknown }) {
  const gross = Number(row.commission_inr ?? 0) + Number(row.bonus_inr ?? 0);
  const hold = Number(row.reliability_hold_pct ?? 0);
  return Math.round(gross * (1 - Math.min(100, Math.max(0, hold)) / 100) * 100) / 100;
}

export const partnerPayoutService = {
  async generateMonth(month?: string) {
    const period = month ?? periodMonth();
    const { data: rows, error } = await supabase
      .from('partner_earnings_ledger')
      .select('id, partner_id, commission_inr, bonus_inr, reliability_hold_pct, status')
      .eq('period_month', period)
      .in('status', ['pending', 'held'])
      .is('payout_batch_id', null);
    throwIfSupabaseError(error, 'Could not load pending partner earnings');

    const byPartner = new Map<string, { ids: string[]; total: number }>();
    for (const row of rows ?? []) {
      const payable = payableAmount(row);
      if (payable <= 0) continue;
      const partnerId = String(row.partner_id);
      const cur = byPartner.get(partnerId) ?? { ids: [], total: 0 };
      cur.ids.push(String(row.id));
      cur.total += payable;
      byPartner.set(partnerId, cur);
    }

    const batches: Array<{ id: string; partnerId: string; totalInr: number; lineCount: number }> = [];
    for (const [partnerId, group] of byPartner) {
      if (group.total <= 0) continue;
      const { data: existing } = await supabase
        .from('partner_payout_batches')
        .select('id, status, total_inr')
        .eq('partner_id', partnerId)
        .eq('period_month', period)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

      if (existing?.status === 'approved') continue;

      let batchId = existing?.id ? String(existing.id) : '';
      if (!batchId) {
        const { data: created, error: createErr } = await supabase
          .from('partner_payout_batches')
          .insert({
            partner_id: partnerId,
            period_month: period,
            total_inr: Math.round(group.total * 100) / 100,
            status: 'pending',
          })
          .select('id, total_inr')
          .single();
        throwIfSupabaseError(createErr, 'Could not create payout batch');
        if (!created?.id) throw new ValidationError('Could not create payout batch');
        batchId = String(created.id);
      } else if (existing?.status === 'pending') {
        await supabase
          .from('partner_payout_batches')
          .update({
            total_inr: Math.round((Number(existing.total_inr) + group.total) * 100) / 100,
          })
          .eq('id', batchId);
      }

      await supabase
        .from('partner_earnings_ledger')
        .update({ payout_batch_id: batchId, updated_at: new Date().toISOString() })
        .in('id', group.ids);

      batches.push({
        id: batchId,
        partnerId,
        totalInr: Math.round(group.total * 100) / 100,
        lineCount: group.ids.length,
      });
    }

    return { period, batches };
  },

  async list(month?: string) {
    const period = month ?? periodMonth();
    const { data, error } = await supabase
      .from('partner_payout_batches')
      .select('id, partner_id, period_month, total_inr, status, approved_by, paid_at, created_at')
      .eq('period_month', period)
      .order('created_at', { ascending: false });
    throwIfSupabaseError(error, 'Could not list payout batches');

    const partnerIds = [...new Set((data ?? []).map((b) => String(b.partner_id)))];
    const partners =
      partnerIds.length === 0
        ? []
        : (
            await supabase.from('partners').select('id, full_name, partner_code').in('id', partnerIds)
          ).data ?? [];
    const map = new Map(partners.map((p) => [String(p.id), p]));
    return (data ?? []).map((b) => ({
      ...b,
      partnerName: map.get(String(b.partner_id))?.full_name ?? 'Partner',
      partnerCode: map.get(String(b.partner_id))?.partner_code ?? null,
    }));
  },

  async approve(batchId: string, actorEmail: string) {
    const { data: batch, error } = await supabase
      .from('partner_payout_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load payout batch');
    if (!batch) throw new ValidationError('Payout batch not found');
    if (batch.status !== 'pending') throw new ValidationError('Only pending batches can be approved');

    await supabase
      .from('partner_earnings_ledger')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('payout_batch_id', batchId)
      .in('status', ['pending', 'held']);

    const { data, error: updErr } = await supabase
      .from('partner_payout_batches')
      .update({ status: 'approved', approved_by: actorEmail })
      .eq('id', batchId)
      .select('*')
      .single();
    throwIfSupabaseError(updErr, 'Could not approve payout batch');
    return data;
  },

  async markPaid(batchId: string) {
    const { data: batch, error } = await supabase
      .from('partner_payout_batches')
      .select('status')
      .eq('id', batchId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load payout batch');
    if (!batch) throw new ValidationError('Payout batch not found');
    if (batch.status !== 'approved') throw new ValidationError('Approve the batch before marking paid');

    await supabase
      .from('partner_earnings_ledger')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('payout_batch_id', batchId)
      .eq('status', 'approved');

    const { data, error: updErr } = await supabase
      .from('partner_payout_batches')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', batchId)
      .select('*')
      .single();
    throwIfSupabaseError(updErr, 'Could not mark payout paid');
    return data;
  },

  async reverseOrder(orderId: string, reason: string) {
    const { data: rows, error } = await supabase
      .from('partner_earnings_ledger')
      .select('id, status, metadata')
      .eq('order_id', orderId)
      .neq('status', 'reversed');
    throwIfSupabaseError(error, 'Could not load partner earnings for reverse');
    if (!rows?.length) return { reversed: 0 };

    const now = new Date().toISOString();
    for (const row of rows) {
      const meta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      await supabase
        .from('partner_earnings_ledger')
        .update({
          status: 'reversed',
          updated_at: now,
          metadata: { ...meta, reversedReason: reason, reversedAt: now },
        })
        .eq('id', row.id);
    }
    return { reversed: rows.length };
  },
};
