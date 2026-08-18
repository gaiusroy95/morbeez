import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { adjustmentRow } from '../../domain/remuneration/dispute-adjustment.js';
import { periodMonth } from '../../domain/remuneration/agronomist-pay.js';
import { settlementService } from './settlement.service.js';
import { agronomistEarningsService } from './agronomist-earnings.service.js';

export const disputeService = {
  async list(filter: { status?: string; partyType?: string; partyId?: string } = {}) {
    let q = supabase.from('earning_disputes').select('*').order('opened_at', { ascending: false }).limit(200);
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.partyType) q = q.eq('party_type', filter.partyType);
    if (filter.partyId) q = q.eq('party_id', filter.partyId);
    const { data } = await q;
    return data ?? [];
  },

  async open(input: {
    partyType: 'partner' | 'employee';
    partyId: string;
    earningSource: 'partner_ledger' | 'agronomist_ledger';
    earningId: string;
    amountInr: number;
    reason: string;
    orderId?: string | null;
    openedBy?: string | null;
  }) {
    const { data: existing } = await supabase
      .from('earning_disputes')
      .select('id')
      .eq('earning_source', input.earningSource)
      .eq('earning_id', input.earningId)
      .eq('status', 'open')
      .maybeSingle();
    if (existing?.id) throw new ConflictError('This earning already has an open dispute');

    const { data, error } = await supabase
      .from('earning_disputes')
      .insert({
        party_type: input.partyType,
        party_id: input.partyId,
        earning_source: input.earningSource,
        earning_id: input.earningId,
        order_id: input.orderId ?? null,
        amount_inr: Math.round(Math.max(0, input.amountInr) * 100) / 100,
        reason: input.reason,
        opened_by: input.openedBy ?? null,
        status: 'open',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not open dispute');
    return data;
  },

  async resolve(id: string, status: 'upheld' | 'rejected', actor?: string, notes?: string) {
    const { data: row } = await supabase.from('earning_disputes').select('*').eq('id', id).maybeSingle();
    if (!row) throw new NotFoundError('Dispute not found');
    if (row.status !== 'open') throw new ConflictError('Dispute already resolved');

    let adjustmentId: string | null = null;
    if (status === 'upheld') {
      adjustmentId = await writeAdjustment(row);
    }

    const { data, error } = await supabase
      .from('earning_disputes')
      .update({
        status,
        notes: notes ?? row.notes,
        resolved_by: actor ?? null,
        resolved_at: new Date().toISOString(),
        adjustment_earning_id: adjustmentId,
      })
      .eq('id', id)
      .eq('status', 'open')
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not resolve dispute');
    if (!data) throw new ConflictError('Dispute already resolved');
    return data;
  },
};

async function writeAdjustment(row: Record<string, unknown>): Promise<string | null> {
  const source = String(row.earning_source);
  const earningId = String(row.earning_id);
  const reason = String(row.reason ?? 'dispute');

  if (source === 'partner_ledger') {
    const { data: original } = await supabase
      .from('partner_earnings_ledger')
      .select('id, partner_id, order_id, commission_inr, bonus_inr, period_month, status')
      .eq('id', earningId)
      .maybeSingle();
    if (!original) throw new NotFoundError('Original partner earning not found');
    const originalInr = Number(original.commission_inr ?? 0) + Number(original.bonus_inr ?? 0);
    const adj = adjustmentRow({
      originalId: String(original.id),
      originalInr,
      disputedInr: Number(row.amount_inr),
      reason,
    });
    if (adj.amountInr >= 0) throw new ValidationError('Dispute amount must recover a positive earning');

    const { data: already } = await supabase
      .from('partner_earnings_ledger')
      .select('id')
      .eq('parent_earning_id', original.id)
      .eq('earning_kind', 'adjustment')
      .maybeSingle();
    if (already?.id) {
      await settlementService.applyReturnRecovery('partner_ledger', String(original.id), Math.abs(adj.amountInr));
      return String(already.id);
    }

    const { data: inserted, error } = await supabase
      .from('partner_earnings_ledger')
      .insert({
        partner_id: original.partner_id,
        order_id: original.order_id ?? row.order_id ?? null,
        category_key: 'adjustment',
        gross_inr: 0,
        commission_inr: adj.amountInr,
        bonus_inr: 0,
        reliability_hold_pct: 0,
        earning_kind: 'adjustment',
        parent_earning_id: original.id,
        status: 'pending',
        period_month: original.period_month ?? periodMonth(),
        metadata: { reason, disputeId: row.id, originalEarningId: original.id },
      })
      .select('id')
      .single();
    throwIfSupabaseError(error, 'Could not write dispute adjustment');
    await settlementService.applyReturnRecovery('partner_ledger', String(original.id), Math.abs(adj.amountInr));
    return inserted?.id ? String(inserted.id) : null;
  }

  const { data: original } = await supabase
    .from('agronomist_earnings_ledger')
    .select('id, agronomist_email, farmer_id, amount_inr, order_id')
    .eq('id', earningId)
    .maybeSingle();
  if (!original) throw new NotFoundError('Original agronomist earning not found');
  const adj = adjustmentRow({
    originalId: String(original.id),
    originalInr: Number(original.amount_inr ?? 0),
    disputedInr: Number(row.amount_inr),
    reason,
  });
  if (adj.amountInr >= 0) throw new ValidationError('Dispute amount must recover a positive earning');

  const credited = await agronomistEarningsService.credit({
    agronomistEmail: String(original.agronomist_email),
    farmerId: original.farmer_id ? String(original.farmer_id) : null,
    eventType: 'sales_adjustment',
    sourceId: `dispute:${row.id}`,
    amountInr: adj.amountInr,
    notes: reason,
  });
  if (credited?.id) {
    await supabase
      .from('agronomist_earnings_ledger')
      .update({ parent_earning_id: original.id, order_id: original.order_id ?? row.order_id ?? null })
      .eq('id', credited.id);
    await settlementService.applyReturnRecovery('agronomist_ledger', String(original.id), Math.abs(adj.amountInr));
    return credited.id;
  }
  return null;
}
