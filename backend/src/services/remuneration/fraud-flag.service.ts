import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { blocksPayout, type FraudFlagType } from '../../domain/remuneration/fraud-hold.js';

async function refreshHolds(partyType: 'partner' | 'employee', partyId: string) {
  const { data: flags } = await supabase
    .from('earning_fraud_flags')
    .select('earning_id, earning_source, status')
    .eq('party_type', partyType)
    .eq('party_id', partyId)
    .in('status', ['open', 'confirmed']);
  const blocking = flags ?? [];
  const holdAll = blocking.some((f) => !f.earning_id);
  const earningIds = blocking.map((f) => (f.earning_id ? String(f.earning_id) : '')).filter(Boolean);

  const { data: rows } = await supabase
    .from('earning_settlements')
    .select('id, earning_id, status, fraud_hold')
    .eq('party_type', partyType)
    .eq('party_id', partyId)
    .in('status', ['pending', 'approved', 'held']);

  for (const row of rows ?? []) {
    const hold = holdAll || (row.earning_id ? earningIds.includes(String(row.earning_id)) : false);
    if (Boolean(row.fraud_hold) === hold) continue;
    await supabase.from('earning_settlements').update({ fraud_hold: hold }).eq('id', row.id);
  }

  if (partyType === 'partner') {
    const { data: ledgers } = await supabase
      .from('partner_earnings_ledger')
      .select('id, status')
      .eq('partner_id', partyId)
      .in('status', ['pending', 'held']);
    for (const row of ledgers ?? []) {
      const hold = holdAll || earningIds.includes(String(row.id));
      const next = hold ? 'held' : 'pending';
      if (row.status === next) continue;
      await supabase
        .from('partner_earnings_ledger')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .in('status', ['pending', 'held']);
    }
  }
}

export const fraudFlagService = {
  async list(filter: { status?: string; partyType?: string; partyId?: string } = {}) {
    let q = supabase.from('earning_fraud_flags').select('*').order('opened_at', { ascending: false }).limit(200);
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.partyType) q = q.eq('party_type', filter.partyType);
    if (filter.partyId) q = q.eq('party_id', filter.partyId);
    const { data } = await q;
    return data ?? [];
  },

  async open(input: {
    partyType: 'partner' | 'employee';
    partyId: string;
    flagType: FraudFlagType;
    reason: string;
    earningSource?: string | null;
    earningId?: string | null;
    orderId?: string | null;
    farmerId?: string | null;
    evidence?: Record<string, unknown>;
    openedBy?: string | null;
  }) {
    const { data, error } = await supabase
      .from('earning_fraud_flags')
      .insert({
        party_type: input.partyType,
        party_id: input.partyId,
        flag_type: input.flagType,
        reason: input.reason,
        earning_source: input.earningSource ?? null,
        earning_id: input.earningId ?? null,
        order_id: input.orderId ?? null,
        farmer_id: input.farmerId ?? null,
        evidence: input.evidence ?? {},
        opened_by: input.openedBy ?? null,
        status: 'open',
      })
      .select('*')
      .maybeSingle();
    if (error && error.code === '23505') {
      const { data: existing } = await supabase
        .from('earning_fraud_flags')
        .select('*')
        .eq('party_type', input.partyType)
        .eq('party_id', input.partyId)
        .eq('flag_type', input.flagType)
        .in('status', ['open', 'confirmed'])
        .maybeSingle();
      return existing;
    }
    throwIfSupabaseError(error, 'Could not open fraud flag');
    if (data) await refreshHolds(input.partyType, input.partyId);
    return data;
  },

  async setStatus(id: string, status: 'confirmed' | 'cleared', actor?: string) {
    const { data: row } = await supabase.from('earning_fraud_flags').select('*').eq('id', id).maybeSingle();
    if (!row) throw new NotFoundError('Fraud flag not found');
    if (row.status === 'cleared' && status !== 'cleared') {
      throw new ValidationError('Cleared flags stay cleared — open a new flag');
    }
    if (!blocksPayout(row.status) && status === 'confirmed') {
      throw new ValidationError('Only an open flag can be confirmed');
    }
    const { data, error } = await supabase
      .from('earning_fraud_flags')
      .update({
        status,
        resolved_by: actor ?? null,
        resolved_at: status === 'cleared' ? new Date().toISOString() : row.resolved_at,
      })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update fraud flag');
    await refreshHolds(String(row.party_type) as 'partner' | 'employee', String(row.party_id));
    return data;
  },

  async scan(limit = 80) {
    let opened = 0;
    const { data: signals } = await supabase
      .from('partner_reliability_signals')
      .select('id, partner_id, farmer_id, signal_type, metadata, created_at')
      .eq('signal_type', 'fraud_flag')
      .order('created_at', { ascending: false })
      .limit(limit);
    for (const row of signals ?? []) {
      const flag = await this.open({
        partyType: 'partner',
        partyId: String(row.partner_id),
        flagType: 'manual',
        reason: 'Reliability fraud_flag signal',
        farmerId: row.farmer_id ? String(row.farmer_id) : null,
        evidence: { signalId: row.id, metadata: row.metadata },
        openedBy: 'system',
      });
      if (flag) opened += 1;
    }

    const { data: intros } = await supabase
      .from('farmer_introductions')
      .select('id, partner_id, farmer_id, fraud_status, partner_earning_id')
      .in('fraud_status', ['hold', 'confirmed_fraud'])
      .limit(limit);
    for (const row of intros ?? []) {
      const flag = await this.open({
        partyType: 'partner',
        partyId: String(row.partner_id),
        flagType: 'introduction_fraud',
        reason: `Introduction ${row.fraud_status}`,
        earningSource: row.partner_earning_id ? 'partner_ledger' : 'introduction',
        earningId: row.partner_earning_id ? String(row.partner_earning_id) : null,
        farmerId: row.farmer_id ? String(row.farmer_id) : null,
        evidence: { introductionId: row.id },
        openedBy: 'system',
      });
      if (flag) opened += 1;
    }

    const { data: orders } = await supabase
      .from('commerce_orders')
      .select('id, farmer_id, attributed_partner_id, attributed_agronomist_email, incentive_excluded_reason')
      .eq('incentive_eligibility', 'excluded')
      .eq('incentive_excluded_reason', 'fraud')
      .limit(limit);
    for (const row of orders ?? []) {
      if (row.attributed_partner_id) {
        await this.open({
          partyType: 'partner',
          partyId: String(row.attributed_partner_id),
          flagType: 'order_fraud',
          reason: 'Order excluded for fraud',
          earningSource: 'order',
          orderId: String(row.id),
          farmerId: row.farmer_id ? String(row.farmer_id) : null,
          evidence: { orderId: row.id },
          openedBy: 'system',
        });
        opened += 1;
      }
    }
    return { scanned: (signals?.length ?? 0) + (intros?.length ?? 0) + (orders?.length ?? 0), opened };
  },
};
