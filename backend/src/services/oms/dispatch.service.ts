import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { omsWorkflowService } from './workflow.service.js';
import { employeeActionLogService } from './employee-action-log.service.js';

export const dispatchService = {
  async startSession(commerceOrderId: string) {
    const { data: order, error: orderErr } = await supabase
      .from('commerce_orders')
      .select('id, tracking_awb, courier_name, oms_status')
      .eq('id', commerceOrderId)
      .single();
    throwIfSupabaseError(orderErr, 'Order for dispatch');
    if (!order) throw new NotFoundError('Order not found');

    const { data: existing } = await supabase
      .from('dispatch_sessions')
      .select('*')
      .eq('commerce_order_id', commerceOrderId)
      .eq('status', 'open')
      .maybeSingle();
    if (existing) return existing;

    const { data: pickList } = await supabase
      .from('pick_lists')
      .select('id')
      .eq('commerce_order_id', commerceOrderId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('dispatch_sessions')
      .insert({
        commerce_order_id: commerceOrderId,
        pick_list_id: pickList?.id ?? null,
        awb_code: order.tracking_awb ?? null,
        courier_name: order.courier_name ?? null,
        status: 'open',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Dispatch session');
    return data;
  },

  async scanAwb(dispatchSessionId: string, scannedCode: string, actorEmail?: string) {
    const { data: session, error } = await supabase
      .from('dispatch_sessions')
      .select('*')
      .eq('id', dispatchSessionId)
      .single();
    throwIfSupabaseError(error, 'Dispatch session');
    if (!session) throw new NotFoundError('Dispatch session not found');

    const code = scannedCode.trim();
    const expected = String(session.awb_code ?? '').trim();
    const ok = expected.length > 0 && code === expected;

    await supabase.from('dispatch_scan_logs').insert({
      dispatch_session_id: dispatchSessionId,
      scanned_code: code,
      result: ok ? 'ok' : expected ? 'wrong_awb' : 'unknown',
      message: ok ? 'AWB verified' : expected ? 'AWB mismatch' : 'No AWB on order',
    });

    if (!ok) {
      return { ok: false, error: expected ? 'AWB does not match shipment' : 'Order has no AWB yet' };
    }

    await supabase
      .from('dispatch_sessions')
      .update({
        status: 'verified',
        verified_by: actorEmail ?? null,
        verified_at: new Date().toISOString(),
      })
      .eq('id', dispatchSessionId);

    await omsWorkflowService.updateStatus(String(session.commerce_order_id), 'shipped');

    if (actorEmail) {
      await employeeActionLogService.log({
        actorEmail,
        actionType: 'dispatch_scan',
        entityType: 'commerce_order',
        entityId: String(session.commerce_order_id),
        details: { awb: code },
      });
    }

    return { ok: true, commerceOrderId: session.commerce_order_id };
  },

  async getSessionForOrder(commerceOrderId: string) {
    const { data, error } = await supabase
      .from('dispatch_sessions')
      .select('*, dispatch_scan_logs(*)')
      .eq('commerce_order_id', commerceOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfSupabaseError(error, 'Dispatch session');
    return data;
  },

  async confirmDispatch(commerceOrderId: string, actorEmail?: string) {
    const session = await this.startSession(commerceOrderId);
    if (!session.awb_code) {
      throw new AppError('Cannot dispatch without AWB / courier label', 400, 'NO_AWB');
    }
    return this.scanAwb(String(session.id), String(session.awb_code), actorEmail);
  },
};
