import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { inventoryService } from '../wms/inventory.service.js';
import { warehouseService } from '../wms/warehouse.service.js';
import { omsWorkflowService } from './workflow.service.js';
const NDR_REASONS = [
    'customer_unreachable',
    'refused_delivery',
    'wrong_address',
    'future_delivery_request',
];
export const ndrRtoService = {
    NDR_REASONS,
    async createFromCourierUpdate(input) {
        const { data: order } = await supabase
            .from('commerce_orders')
            .select('id')
            .eq('shopify_order_id', input.shopifyOrderId)
            .maybeSingle();
        const { data, error } = await supabase
            .from('shipment_exceptions')
            .insert({
            shopify_order_id: input.shopifyOrderId,
            commerce_order_id: order?.id ?? null,
            exception_type: input.exceptionType,
            reason: input.reason ?? null,
            courier_payload: input.courierPayload ?? null,
            status: 'open',
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Shipment exception');
        if (input.exceptionType === 'rto' && order?.id) {
            await omsWorkflowService.updateStatus(String(order.id), 'returned');
        }
        return data;
    },
    async listOpen(limit = 50) {
        const { data, error } = await supabase
            .from('shipment_exceptions')
            .select('*, commerce_orders(order_name, phone)')
            .in('status', ['open', 'reattempt'])
            .order('created_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'NDR/RTO list');
        return data ?? [];
    },
    async resolveException(exceptionId, action, qcStatus) {
        const { data: ex, error } = await supabase
            .from('shipment_exceptions')
            .select('*')
            .eq('id', exceptionId)
            .single();
        throwIfSupabaseError(error, 'Exception');
        if (!ex)
            throw new NotFoundError('Exception not found');
        const statusMap = {
            reattempt: 'reattempt',
            rto_received: 'rto_received',
            restocked: 'restocked',
            written_off: 'written_off',
        };
        await supabase
            .from('shipment_exceptions')
            .update({
            status: statusMap[action] ?? 'resolved',
            qc_status: qcStatus ?? (action === 'restocked' ? 'pass' : ex.qc_status),
            updated_at: new Date().toISOString(),
        })
            .eq('id', exceptionId);
        if (action === 'restocked' && ex.commerce_order_id) {
            await this.restockFromRto(String(ex.commerce_order_id), qcStatus === 'damage');
        }
        return ex;
    },
    async restockFromRto(commerceOrderId, asDamaged = false) {
        const warehouse = await warehouseService.getDefaultWarehouse();
        const { data: lines } = await supabase
            .from('commerce_order_lines')
            .select('*')
            .eq('commerce_order_id', commerceOrderId);
        for (const line of lines ?? []) {
            const qty = Number(line.qty_shipped) || Number(line.qty_ordered);
            if (qty <= 0 || !line.inventory_item_id)
                continue;
            const batchCode = `RTO-${commerceOrderId.slice(0, 8)}-${line.sku}`;
            if (asDamaged) {
                await inventoryService.createBatchFromGrn({
                    inventoryItemId: String(line.inventory_item_id),
                    warehouseId: String(warehouse.id),
                    batchCode,
                    qty: 0,
                });
                const { data: batch } = await supabase
                    .from('inventory_batches')
                    .select('id')
                    .eq('batch_code', batchCode)
                    .maybeSingle();
                if (batch) {
                    await supabase
                        .from('inventory_batches')
                        .update({ qty_damaged: qty, status: 'quarantine' })
                        .eq('id', batch.id);
                }
            }
            else {
                await inventoryService.createBatchFromGrn({
                    inventoryItemId: String(line.inventory_item_id),
                    warehouseId: String(warehouse.id),
                    batchCode,
                    qty,
                });
                await supabase.from('stock_movements').insert({
                    movement_type: 'return_restock',
                    inventory_item_id: line.inventory_item_id,
                    warehouse_id: warehouse.id,
                    qty,
                    ref_type: 'commerce_order',
                    ref_id: commerceOrderId,
                });
            }
        }
    },
    async detectFromTrackingStatus(shopifyOrderId, status, payload) {
        const s = status.toLowerCase();
        if (/ndr|non delivery|not reachable|refused/.test(s)) {
            return this.createFromCourierUpdate({
                shopifyOrderId: shopifyOrderId ?? String(payload.order_id ?? ''),
                exceptionType: 'ndr',
                reason: status,
                courierPayload: payload,
            });
        }
        if (/rto|return to origin|returned/.test(s)) {
            return this.createFromCourierUpdate({
                shopifyOrderId: shopifyOrderId ?? String(payload.order_id ?? ''),
                exceptionType: 'rto',
                reason: status,
                courierPayload: payload,
            });
        }
        return null;
    },
};
//# sourceMappingURL=ndr-rto.service.js.map