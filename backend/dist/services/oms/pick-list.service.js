import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { inventoryService } from '../wms/inventory.service.js';
import { warehouseService } from '../wms/warehouse.service.js';
function waveNumber() {
    return `WAVE-${Date.now()}`;
}
export const pickListService = {
    async generateForOrder(commerceOrderId, createdBy) {
        const warehouse = await warehouseService.getDefaultWarehouse();
        const { data: existing } = await supabase
            .from('pick_lists')
            .select('id')
            .eq('commerce_order_id', commerceOrderId)
            .maybeSingle();
        if (existing)
            return this.getPickList(String(existing.id));
        const { data: lines, error: lineErr } = await supabase
            .from('commerce_order_lines')
            .select('*')
            .eq('commerce_order_id', commerceOrderId);
        throwIfSupabaseError(lineErr, 'Order lines');
        if (!lines?.length)
            throw new NotFoundError('No order lines to pick');
        const { data: wave, error: waveErr } = await supabase
            .from('pick_waves')
            .insert({
            wave_number: waveNumber(),
            warehouse_id: warehouse.id,
            status: 'open',
            created_by: createdBy ?? null,
        })
            .select('*')
            .single();
        throwIfSupabaseError(waveErr, 'Pick wave');
        const { data: pickList, error: plErr } = await supabase
            .from('pick_lists')
            .insert({
            pick_wave_id: wave.id,
            commerce_order_id: commerceOrderId,
            status: 'pending',
        })
            .select('*')
            .single();
        throwIfSupabaseError(plErr, 'Pick list');
        for (const line of lines) {
            const qty = Number(line.qty_ordered) - Number(line.qty_cancelled);
            if (qty <= 0)
                continue;
            const allocations = await inventoryService.reserveStock({
                inventoryItemId: String(line.inventory_item_id),
                warehouseId: String(warehouse.id),
                qty,
                orderLineId: String(line.id),
            });
            for (const alloc of allocations) {
                const a = alloc;
                await supabase.from('pick_list_lines').insert({
                    pick_list_id: pickList.id,
                    order_line_id: line.id,
                    allocation_id: a.id,
                    inventory_item_id: line.inventory_item_id,
                    batch_id: a.batch_id,
                    location_id: a.location_id,
                    product_title: line.product_title,
                    sku: line.sku,
                    batch_code: a.batchCode,
                    rack_location: a.rackLocation,
                    qty_required: a.qty_allocated,
                });
                await supabase
                    .from('commerce_order_lines')
                    .update({
                    qty_allocated: qty,
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', line.id);
            }
        }
        await supabase
            .from('pick_lists')
            .update({ status: 'picking', updated_at: new Date().toISOString() })
            .eq('id', pickList.id);
        return this.getPickList(String(pickList.id));
    },
    async getPickList(pickListId) {
        const { data, error } = await supabase
            .from('pick_lists')
            .select('*, commerce_orders(order_name, shopify_order_id, oms_status), pick_list_lines(*)')
            .eq('id', pickListId)
            .single();
        throwIfSupabaseError(error, 'Get pick list');
        if (!data)
            throw new NotFoundError('Pick list not found');
        return data;
    },
    async listPickLists(opts) {
        let q = supabase
            .from('pick_lists')
            .select('*, commerce_orders(order_name, shopify_order_id, oms_status, is_cod)')
            .order('created_at', { ascending: false })
            .limit(opts?.limit ?? 50);
        if (opts?.status)
            q = q.eq('status', opts.status);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'List pick lists');
        return data ?? [];
    },
    async markLinePicked(pickListLineId, qty) {
        const { data: line, error } = await supabase
            .from('pick_list_lines')
            .select('*')
            .eq('id', pickListLineId)
            .single();
        throwIfSupabaseError(error, 'Pick line');
        if (!line)
            throw new NotFoundError('Pick line not found');
        const pickQty = qty ?? Number(line.qty_required);
        if (line.allocation_id) {
            await inventoryService.pickAllocation(String(line.allocation_id), pickQty);
        }
        await supabase
            .from('pick_list_lines')
            .update({ qty_picked: pickQty })
            .eq('id', pickListLineId);
        return line;
    },
    async manualVerifyLine(pickListLineId) {
        const { data: line, error } = await supabase
            .from('pick_list_lines')
            .select('*')
            .eq('id', pickListLineId)
            .single();
        throwIfSupabaseError(error, 'Pick line verify');
        if (!line)
            throw new NotFoundError('Pick line not found');
        if (line.allocation_id) {
            await inventoryService.pickAllocation(String(line.allocation_id), Number(line.qty_required));
        }
        await supabase
            .from('pick_list_lines')
            .update({
            manually_verified: true,
            qty_picked: line.qty_required,
        })
            .eq('id', pickListLineId);
        return line;
    },
    async completePicking(pickListId) {
        await supabase
            .from('pick_lists')
            .update({
            status: 'picked',
            picked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', pickListId);
        return this.getPickList(pickListId);
    },
};
//# sourceMappingURL=pick-list.service.js.map