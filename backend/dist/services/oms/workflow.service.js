import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { orderSyncService } from './order-sync.service.js';
import { pickListService } from './pick-list.service.js';
import { packService } from './pack.service.js';
import { invoiceService } from './invoice.service.js';
import { codService } from './cod.service.js';
import { shiprocketService } from '../shiprocket/shiprocket.service.js';
import { logger } from '../../lib/logger.js';
export const omsWorkflowService = {
    async onOrderPlaced(shopifyOrderId, order) {
        await orderSyncService.syncOrderMetadata(order ?? { id: Number(shopifyOrderId) });
        await orderSyncService.syncOrderLines(shopifyOrderId, order);
        const { data: row } = await supabase
            .from('commerce_orders')
            .select('id, is_cod, financial_status, oms_status')
            .eq('shopify_order_id', shopifyOrderId)
            .single();
        if (!row)
            return;
        const autoConfirm = row.is_cod ||
            row.financial_status === 'paid' ||
            env.ENABLE_OMS_AUTO_CONFIRM !== false;
        if (autoConfirm && row.oms_status === 'pending') {
            await this.confirmOrder(String(row.id));
        }
        if (row.is_cod) {
            await codService.recordOnOrder(String(row.id), shopifyOrderId);
        }
    },
    async confirmOrder(commerceOrderId) {
        const { data: order, error } = await supabase
            .from('commerce_orders')
            .select('*')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(error, 'Confirm order');
        if (!order)
            throw new NotFoundError('Order not found');
        await supabase
            .from('commerce_orders')
            .update({
            oms_status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', commerceOrderId);
        const pickList = await pickListService.generateForOrder(commerceOrderId);
        await supabase
            .from('commerce_orders')
            .update({
            oms_status: 'picking',
            updated_at: new Date().toISOString(),
        })
            .eq('id', commerceOrderId);
        return pickList;
    },
    async completePacking(pickListId, verifiedBy) {
        const { data: pickList } = await supabase
            .from('pick_lists')
            .select('commerce_order_id')
            .eq('id', pickListId)
            .single();
        if (!pickList)
            throw new NotFoundError('Pick list not found');
        await packService.completePack(pickListId, verifiedBy);
        const commerceOrderId = String(pickList.commerce_order_id);
        await supabase
            .from('commerce_orders')
            .update({
            oms_status: 'packed',
            packed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', commerceOrderId);
        const invoice = await invoiceService.generateTaxInvoice(commerceOrderId);
        const { data: order } = await supabase
            .from('commerce_orders')
            .select('shopify_order_id, is_cod, financial_status')
            .eq('id', commerceOrderId)
            .single();
        const shouldShip = env.ENABLE_SHIPROCKET_AFTER_PACK !== false &&
            order?.shopify_order_id &&
            (order.financial_status === 'paid' || order.is_cod);
        if (shouldShip) {
            const shipment = await shiprocketService
                .createShipmentForShopifyOrder(String(order.shopify_order_id))
                .catch((err) => {
                logger.error({ err, commerceOrderId }, 'Shiprocket after pack failed');
                return null;
            });
            if (shipment?.awb) {
                await supabase
                    .from('commerce_orders')
                    .update({
                    tracking_awb: shipment.awb,
                    courier_name: shipment.courier ?? 'Shiprocket',
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', commerceOrderId);
            }
            // Status moves to shipped after dispatch scan verification
        }
        return { invoice, pickListId };
    },
    async updateStatus(commerceOrderId, status) {
        const patch = {
            oms_status: status,
            updated_at: new Date().toISOString(),
        };
        if (status === 'shipped')
            patch.shipped_at = new Date().toISOString();
        if (status === 'delivered' || status === 'completed')
            patch.delivered_at = new Date().toISOString();
        const { error } = await supabase.from('commerce_orders').update(patch).eq('id', commerceOrderId);
        throwIfSupabaseError(error, 'OMS status update');
    },
    async getOrderWorkflow(commerceOrderId) {
        const { data: order, error } = await supabase
            .from('commerce_orders')
            .select('*, commerce_order_lines(*), pick_lists(*, pick_list_lines(*)), invoices(*), cod_reconciliation(*)')
            .eq('id', commerceOrderId)
            .single();
        throwIfSupabaseError(error, 'Order workflow');
        if (!order)
            throw new NotFoundError('Order not found');
        return order;
    },
    async listOmsOrders(opts) {
        let q = supabase
            .from('commerce_orders')
            .select('id, shopify_order_id, order_name, oms_status, is_cod, total_amount, created_at')
            .order('created_at', { ascending: false })
            .limit(opts?.limit ?? 50);
        if (opts?.omsStatus)
            q = q.eq('oms_status', opts.omsStatus);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'OMS orders');
        return data ?? [];
    },
};
//# sourceMappingURL=workflow.service.js.map