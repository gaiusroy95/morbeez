import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';

export const codService = {
  async recordOnOrder(commerceOrderId: string, shopifyOrderId: string) {
    const { data: order } = await supabase
      .from('commerce_orders')
      .select('total_amount, is_cod')
      .eq('id', commerceOrderId)
      .single();
    if (!order?.is_cod) return null;

    const { data, error } = await supabase
      .from('cod_reconciliation')
      .upsert(
        {
          commerce_order_id: commerceOrderId,
          shopify_order_id: shopifyOrderId,
          cod_amount: order.total_amount ?? 0,
          remittance_status: 'pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'commerce_order_id' }
      )
      .select('*')
      .single();
    throwIfSupabaseError(error, 'COD record');
    return data;
  },

  async updateRemittance(input: {
    commerceOrderId: string;
    courierRemittance: number;
    courierName?: string;
    remittanceDate?: string;
  }) {
    const { data: row } = await supabase
      .from('cod_reconciliation')
      .select('*')
      .eq('commerce_order_id', input.commerceOrderId)
      .single();
    if (!row) throw new NotFoundError('COD record not found');

    const cod = Number(row.cod_amount) || 0;
    const paid = input.courierRemittance;
    let status: 'pending' | 'partial' | 'cleared' | 'mismatch' = 'cleared';
    if (paid <= 0) status = 'pending';
    else if (paid < cod) status = 'partial';
    else if (paid > cod) status = 'mismatch';

    const { data, error } = await supabase
      .from('cod_reconciliation')
      .update({
        courier_remittance: paid,
        remittance_status: status,
        courier_name: input.courierName ?? null,
        remittance_date: input.remittanceDate ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('commerce_order_id', input.commerceOrderId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'COD remittance');
    return data;
  },

  async listPending(limit = 50) {
    const { data, error } = await supabase
      .from('cod_reconciliation')
      .select('*, commerce_orders(order_name, shopify_order_id)')
      .in('remittance_status', ['pending', 'partial', 'mismatch'])
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'COD pending');
    return data ?? [];
  },
};
