import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { shiprocketService } from '../shiprocket/shiprocket.service.js';
import { packService } from './pack.service.js';
import { omsWorkflowService } from './workflow.service.js';
import { invoiceService } from './invoice.service.js';
import { employeeActionLogService } from './employee-action-log.service.js';
import { suggestDispatchRack } from './fulfillment-dispatch-racks.js';
const FULFILLMENT_STATUSES = [
    'confirmed',
    'awb_generated',
    'picking',
    'packed',
    'ready_dispatch',
];
const EXCEPTION_TYPES = [
    'stock_missing',
    'wrong_barcode',
    'reprint_label',
    'courier_failed',
    'weight_mismatch',
];
function startOfTodayIso() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}
export const fulfillmentService = {
    async getStats() {
        const today = startOfTodayIso();
        const [pending, ready, packedToday, courierPending, failedAwb] = await Promise.all([
            supabase
                .from('commerce_orders')
                .select('id', { count: 'exact', head: true })
                .in('oms_status', ['confirmed', 'awb_generated', 'picking']),
            supabase
                .from('commerce_orders')
                .select('id', { count: 'exact', head: true })
                .in('oms_status', ['awb_generated', 'picking'])
                .not('tracking_awb', 'is', null),
            supabase
                .from('commerce_orders')
                .select('id', { count: 'exact', head: true })
                .eq('oms_status', 'packed')
                .gte('packed_at', today),
            supabase
                .from('commerce_orders')
                .select('id', { count: 'exact', head: true })
                .in('oms_status', ['packed', 'ready_dispatch']),
            supabase
                .from('commerce_orders')
                .select('id', { count: 'exact', head: true })
                .not('shiprocket_error', 'is', null)
                .in('oms_status', ['confirmed', 'picking', 'awb_generated']),
        ]);
        return {
            pendingOrders: pending.count ?? 0,
            readyToPack: ready.count ?? 0,
            packedToday: packedToday.count ?? 0,
            courierPending: courierPending.count ?? 0,
            failedAwb: failedAwb.count ?? 0,
        };
    },
    async getQueue(opts) {
        const { data, error } = await supabase
            .from('commerce_orders')
            .select(`id, order_name, shopify_order_id, oms_status, courier_name, tracking_awb,
         fulfillment_priority, is_cod, total_amount, created_at, shiprocket_error,
         pick_lists(id, status, pick_list_lines(id))`)
            .in('oms_status', [...FULFILLMENT_STATUSES])
            .order('fulfillment_priority', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(opts?.limit ?? 80);
        throwIfSupabaseError(error, 'Fulfillment queue');
        return (data ?? []).map((row) => {
            const pickLists = (row.pick_lists ?? []);
            const pick = pickLists[0];
            const itemCount = pick?.pick_list_lines?.length ?? 0;
            return {
                id: row.id,
                orderName: row.order_name ?? row.shopify_order_id ?? row.id.slice(0, 8),
                courier: row.courier_name ?? '—',
                itemCount,
                priority: row.fulfillment_priority ?? 'normal',
                omsStatus: row.oms_status,
                awb: row.tracking_awb,
                pickListId: pick?.id ?? null,
                shiprocketError: row.shiprocket_error,
                isCod: row.is_cod,
                totalAmount: row.total_amount,
            };
        });
    },
    async getOrderDetail(commerceOrderId) {
        const order = await omsWorkflowService.getOrderWorkflow(commerceOrderId);
        const pickLists = (order.pick_lists ?? []);
        const pickList = pickLists[0] ?? null;
        let packSession = null;
        if (pickList?.id) {
            const { data: sess } = await supabase
                .from('pack_sessions')
                .select('*')
                .eq('pick_list_id', pickList.id)
                .eq('status', 'open')
                .maybeSingle();
            packSession = sess;
        }
        const { data: invoices } = await supabase
            .from('invoices')
            .select('id, invoice_number, document_type')
            .eq('commerce_order_id', commerceOrderId)
            .eq('document_type', 'tax_invoice')
            .order('created_at', { ascending: false })
            .limit(1);
        return {
            order,
            pickList,
            packSession,
            invoice: invoices?.[0] ?? null,
            suggestedDispatchRack: suggestDispatchRack(order.courier_name),
            printEnabled: Boolean(packSession?.scan_complete),
        };
    },
    async provisionShipment(commerceOrderId, actorEmail) {
        if (env.ENABLE_SHIPROCKET_ON_CONFIRM === false) {
            throw new AppError('Shiprocket on confirm is disabled', 400, 'SHIPROCKET_DISABLED');
        }
        const result = await shiprocketService.provisionForCommerceOrder(commerceOrderId).catch((err) => {
            const msg = err instanceof Error ? err.message : 'Shiprocket failed';
            void supabase
                .from('commerce_orders')
                .update({
                shiprocket_error: msg,
                updated_at: new Date().toISOString(),
            })
                .eq('id', commerceOrderId);
            throw err;
        });
        if (!result) {
            await supabase
                .from('commerce_orders')
                .update({
                shiprocket_error: 'Missing address or order lines',
                updated_at: new Date().toISOString(),
            })
                .eq('id', commerceOrderId);
            throw new AppError('Cannot create shipment — check address and line items', 409, 'SHIPROCKET_SKIP');
        }
        const dispatchRack = suggestDispatchRack(result.courier);
        await supabase
            .from('commerce_orders')
            .update({
            shiprocket_order_id: result.shiprocketOrderId,
            shiprocket_shipment_id: result.shipmentId,
            tracking_awb: result.awb,
            tracking_url: result.trackingUrl,
            courier_name: result.courier,
            label_url: result.labelUrl,
            dispatch_rack: dispatchRack,
            awb_generated_at: new Date().toISOString(),
            shiprocket_error: null,
            oms_status: 'awb_generated',
            updated_at: new Date().toISOString(),
        })
            .eq('id', commerceOrderId);
        await supabase
            .from('commerce_orders')
            .update({ oms_status: 'picking', updated_at: new Date().toISOString() })
            .eq('id', commerceOrderId)
            .eq('oms_status', 'awb_generated');
        if (actorEmail) {
            await employeeActionLogService.log({
                actorEmail,
                actionType: 'awb_generated',
                entityType: 'commerce_order',
                entityId: commerceOrderId,
                details: { awb: result.awb, courier: result.courier },
            });
        }
        return result;
    },
    async markPackedForOrder(commerceOrderId, actorEmail) {
        const pickListId = await this.getPickListIdForOrder(commerceOrderId);
        return this.markPacked(pickListId, actorEmail);
    },
    async markPacked(pickListId, actorEmail) {
        const result = await omsWorkflowService.completePacking(pickListId, actorEmail);
        const { data: pick } = await supabase
            .from('pick_lists')
            .select('commerce_order_id')
            .eq('id', pickListId)
            .single();
        if (pick?.commerce_order_id) {
            const rack = await supabase
                .from('commerce_orders')
                .select('courier_name, dispatch_rack')
                .eq('id', pick.commerce_order_id)
                .single();
            if (!rack.data?.dispatch_rack && rack.data?.courier_name) {
                await supabase
                    .from('commerce_orders')
                    .update({
                    dispatch_rack: suggestDispatchRack(rack.data.courier_name),
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', pick.commerce_order_id);
            }
        }
        return result;
    },
    async markLabelPrinted(commerceOrderId, actorEmail) {
        const { data: order, error } = await supabase
            .from('commerce_orders')
            .select('id, oms_status, tracking_awb')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(error, 'Order');
        if (!order)
            throw new NotFoundError('Order not found');
        if (!order.tracking_awb) {
            throw new AppError('Generate AWB before printing label', 400, 'NO_AWB');
        }
        await this.ensureInvoice(commerceOrderId);
        await supabase
            .from('commerce_orders')
            .update({
            oms_status: 'ready_dispatch',
            ready_dispatch_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', commerceOrderId);
        if (actorEmail) {
            await employeeActionLogService.log({
                actorEmail,
                actionType: 'label_printed',
                entityType: 'commerce_order',
                entityId: commerceOrderId,
            });
        }
        return { ok: true };
    },
    async assignDispatchRack(commerceOrderId, rack) {
        const { error } = await supabase
            .from('commerce_orders')
            .update({
            dispatch_rack: rack.trim(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', commerceOrderId);
        throwIfSupabaseError(error, 'Dispatch rack');
        return { ok: true, rack: rack.trim() };
    },
    async reportException(commerceOrderId, type, note, actorEmail) {
        if (!EXCEPTION_TYPES.includes(type)) {
            throw new AppError('Unknown exception type', 400, 'VALIDATION');
        }
        if (type === 'courier_failed') {
            await supabase
                .from('commerce_orders')
                .update({
                shiprocket_error: note ?? 'Courier assignment failed',
                updated_at: new Date().toISOString(),
            })
                .eq('id', commerceOrderId);
        }
        if (type === 'reprint_label') {
            const provisioned = await this.provisionShipment(commerceOrderId, actorEmail).catch((err) => {
                logger.error({ err, commerceOrderId }, 'Reprint label / AWB retry failed');
                return null;
            });
            if (provisioned)
                return { ok: true, retried: true, awb: provisioned.awb };
        }
        if (actorEmail) {
            await employeeActionLogService.log({
                actorEmail,
                actionType: `fulfillment_${type}`,
                entityType: 'commerce_order',
                entityId: commerceOrderId,
                details: { note: note ?? null },
            });
        }
        return { ok: true, type, note: note ?? null };
    },
    async getPickListIdForOrder(commerceOrderId) {
        const { data, error } = await supabase
            .from('pick_lists')
            .select('id')
            .eq('commerce_order_id', commerceOrderId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Pick list lookup');
        if (!data)
            throw new NotFoundError('Pick list not found for order');
        return String(data.id);
    },
    async ensurePackSession(pickListId) {
        return packService.startSession(pickListId, 'barcode');
    },
    async ensurePackSessionForOrder(commerceOrderId) {
        const pickListId = await this.getPickListIdForOrder(commerceOrderId);
        return this.ensurePackSession(pickListId);
    },
    async scan(packSessionId, code) {
        return packService.scanFulfillment(packSessionId, code);
    },
    async confirmOrder(commerceOrderId) {
        return omsWorkflowService.confirmOrder(commerceOrderId);
    },
    async ensureInvoice(commerceOrderId) {
        const { data: existing } = await supabase
            .from('invoices')
            .select('id')
            .eq('commerce_order_id', commerceOrderId)
            .eq('document_type', 'tax_invoice')
            .maybeSingle();
        if (existing)
            return existing;
        return invoiceService.generateTaxInvoice(commerceOrderId);
    },
};
//# sourceMappingURL=fulfillment.service.js.map