import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export const financeService = {
  async getDashboard() {
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = `${today}T00:00:00.000Z`;

    const [ordersRes, codRes, invoicesRes] = await Promise.all([
      supabase
        .from('commerce_orders')
        .select('total_amount, oms_status, is_cod')
        .gte('created_at', startOfDay),
      supabase
        .from('cod_reconciliation')
        .select('cod_amount, courier_remittance, remittance_status'),
      supabase
        .from('invoices')
        .select('cgst, sgst, igst, total, document_type')
        .eq('document_type', 'tax_invoice')
        .gte('created_at', startOfDay),
    ]);

    throwIfSupabaseError(ordersRes.error, 'Finance orders');
    throwIfSupabaseError(codRes.error, 'Finance COD');
    throwIfSupabaseError(invoicesRes.error, 'Finance invoices');

    const dailySales = (ordersRes.data ?? []).reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    );
    const gstLiability = (invoicesRes.data ?? []).reduce(
      (sum, i) => sum + (Number(i.cgst) || 0) + (Number(i.sgst) || 0) + (Number(i.igst) || 0),
      0
    );
    const pendingCod = (codRes.data ?? [])
      .filter((c) => c.remittance_status === 'pending' || c.remittance_status === 'partial')
      .reduce((sum, c) => sum + (Number(c.cod_amount) || 0) - (Number(c.courier_remittance) || 0), 0);

    const openExceptions = await supabase
      .from('shipment_exceptions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'reattempt']);

    return {
      dailySales,
      gstLiability,
      pendingCod,
      refunds: 0,
      outstandingPayments: pendingCod,
      ordersToday: ordersRes.data?.length ?? 0,
      openNdrRto: openExceptions.count ?? 0,
    };
  },

  async refreshDailySnapshot(date?: string) {
    const snapshotDate = date ?? new Date().toISOString().slice(0, 10);
    const dash = await this.getDashboard();

    const { data, error } = await supabase
      .from('finance_daily_snapshots')
      .upsert(
        {
          snapshot_date: snapshotDate,
          gross_sales: dash.dailySales,
          gst_liability: dash.gstLiability,
          pending_cod: dash.pendingCod,
          refunds: dash.refunds,
          outstanding_payments: dash.outstandingPayments,
        },
        { onConflict: 'snapshot_date' }
      )
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Finance snapshot');
    return data;
  },
};
