import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { warehouseService } from './warehouse.service.js';
function mapInventoryItemRow(row) {
    return {
        id: String(row.id),
        sku: String(row.sku),
        productTitle: String(row.product_title),
    };
}
export const inventoryService = {
    async listInventoryItems(opts) {
        let q = supabase
            .from('inventory_items')
            .select('id, sku, product_title')
            .eq('active', true);
        if (opts?.search?.trim()) {
            const s = `%${opts.search.trim()}%`;
            q = q.or(`sku.ilike.${s},product_title.ilike.${s}`);
        }
        const { data, error } = await q.order('product_title');
        throwIfSupabaseError(error, 'List inventory items');
        return (data ?? []).map((row) => mapInventoryItemRow(row));
    },
    async updateInventoryItem(id, input) {
        if (input.sku === undefined && input.productTitle === undefined) {
            throw new AppError('Nothing to update', 400, 'VALIDATION_ERROR');
        }
        const patch = { updated_at: new Date().toISOString() };
        if (input.sku !== undefined)
            patch.sku = input.sku.trim();
        if (input.productTitle !== undefined)
            patch.product_title = input.productTitle.trim();
        const { data, error } = await supabase
            .from('inventory_items')
            .update(patch)
            .eq('id', id)
            .eq('active', true)
            .select('id, sku, product_title')
            .maybeSingle();
        throwIfSupabaseError(error, 'Update inventory item');
        if (!data)
            throw new NotFoundError('Inventory item not found');
        return mapInventoryItemRow(data);
    },
    async deactivateInventoryItem(id) {
        const { data: item } = await supabase
            .from('inventory_items')
            .select('id')
            .eq('id', id)
            .eq('active', true)
            .maybeSingle();
        if (!item)
            throw new NotFoundError('Inventory item not found');
        const { data: batches } = await supabase
            .from('inventory_batches')
            .select('qty_on_hand, qty_reserved')
            .eq('inventory_item_id', id);
        const hasStock = (batches ?? []).some((b) => (Number(b.qty_on_hand) || 0) + (Number(b.qty_reserved) || 0) > 0);
        if (hasStock) {
            throw new AppError('Cannot remove a product that still has stock on hand', 409, 'INVENTORY_ITEM_IN_USE');
        }
        const { error } = await supabase
            .from('inventory_items')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', id);
        throwIfSupabaseError(error, 'Deactivate inventory item');
    },
    async upsertItemFromSku(input) {
        const { data: existing } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('sku', input.sku)
            .maybeSingle();
        if (existing) {
            const { data, error } = await supabase
                .from('inventory_items')
                .update({
                product_title: input.productTitle,
                shopify_variant_id: input.shopifyVariantId ?? existing.shopify_variant_id,
                barcode: input.barcode ?? existing.barcode,
                hsn_code: input.hsnCode ?? existing.hsn_code,
                gst_percent: input.gstPercent ?? existing.gst_percent,
                updated_at: new Date().toISOString(),
            })
                .eq('id', existing.id)
                .select('*')
                .single();
            throwIfSupabaseError(error, 'Update inventory item');
            return data;
        }
        const { data, error } = await supabase
            .from('inventory_items')
            .insert({
            sku: input.sku,
            product_title: input.productTitle,
            shopify_variant_id: input.shopifyVariantId ?? null,
            barcode: input.barcode ?? null,
            hsn_code: input.hsnCode ?? null,
            gst_percent: input.gstPercent ?? 18,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Insert inventory item');
        return data;
    },
    async getStockSummary(opts) {
        const warehouse = opts?.warehouseId
            ? { id: opts.warehouseId }
            : await warehouseService.getDefaultWarehouse();
        let itemQuery = supabase.from('inventory_items').select('*').eq('active', true);
        if (opts?.search?.trim()) {
            const s = `%${opts.search.trim()}%`;
            itemQuery = itemQuery.or(`sku.ilike.${s},product_title.ilike.${s}`);
        }
        const { data: items, error: itemErr } = await itemQuery.order('product_title');
        throwIfSupabaseError(itemErr, 'Stock items');
        const { data: batches, error: batchErr } = await supabase
            .from('inventory_batches')
            .select('*, warehouse_locations(zone, rack, shelf, bin, location_code)')
            .eq('warehouse_id', warehouse.id)
            .neq('status', 'depleted');
        throwIfSupabaseError(batchErr, 'Stock batches');
        const { data: poLines } = await supabase
            .from('purchase_order_lines')
            .select('inventory_item_id, qty_ordered, qty_received, purchase_orders!inner(status)')
            .in('purchase_orders.status', ['sent', 'partial']);
        const incomingByItem = new Map();
        for (const line of poLines ?? []) {
            const ordered = Number(line.qty_ordered) || 0;
            const received = Number(line.qty_received) || 0;
            const pending = Math.max(0, ordered - received);
            const key = String(line.inventory_item_id);
            incomingByItem.set(key, (incomingByItem.get(key) ?? 0) + pending);
        }
        const batchesByItem = new Map();
        for (const b of batches ?? []) {
            const key = String(b.inventory_item_id);
            const list = batchesByItem.get(key) ?? [];
            list.push(b);
            batchesByItem.set(key, list);
        }
        const rows = (items ?? []).map((item) => {
            const itemBatches = batchesByItem.get(String(item.id)) ?? [];
            let available = 0;
            let reserved = 0;
            let damaged = 0;
            let returned = 0;
            const batchRows = itemBatches.map((b) => {
                const onHand = Number(b.qty_on_hand) || 0;
                const res = Number(b.qty_reserved) || 0;
                const dmg = Number(b.qty_damaged) || 0;
                const ret = Number(b.qty_returned) || 0;
                available += Math.max(0, onHand - res);
                reserved += res;
                damaged += dmg;
                returned += ret;
                const loc = b.warehouse_locations;
                return {
                    id: String(b.id),
                    batchCode: String(b.batch_code),
                    qtyOnHand: onHand,
                    qtyReserved: res,
                    qtyDamaged: dmg,
                    qtyReturned: ret,
                    expiryDate: b.expiry_date ? String(b.expiry_date) : null,
                    rackLocation: loc ? warehouseService.formatLocationDisplay(loc) : null,
                };
            });
            return {
                inventoryItemId: String(item.id),
                sku: String(item.sku),
                productTitle: String(item.product_title),
                available,
                reserved,
                damaged,
                returned,
                incoming: incomingByItem.get(String(item.id)) ?? 0,
                batches: batchRows,
            };
        });
        return rows;
    },
    async createBatchFromGrn(input) {
        if (input.qty <= 0)
            throw new AppError('Quantity must be positive', 400, 'VALIDATION');
        const { data: existing } = await supabase
            .from('inventory_batches')
            .select('*')
            .eq('inventory_item_id', input.inventoryItemId)
            .eq('batch_code', input.batchCode)
            .eq('warehouse_id', input.warehouseId)
            .maybeSingle();
        let batch;
        const costFields = {
            supplier_cost: input.supplierCost ?? null,
            freight_cost: input.freightCost ?? 0,
            customs_cost: input.customsCost ?? 0,
            packaging_cost: input.packagingCost ?? 0,
            misc_cost: input.miscCost ?? 0,
            landed_unit_cost: input.landedUnitCost ?? input.supplierCost ?? null,
        };
        if (existing) {
            const { data, error } = await supabase
                .from('inventory_batches')
                .update({
                qty_on_hand: Number(existing.qty_on_hand) + input.qty,
                location_id: input.locationId ?? existing.location_id,
                status: 'active',
                updated_at: new Date().toISOString(),
                ...(input.landedUnitCost != null ? costFields : {}),
            })
                .eq('id', existing.id)
                .select('*')
                .single();
            throwIfSupabaseError(error, 'Update batch');
            batch = data;
        }
        else {
            const { data, error } = await supabase
                .from('inventory_batches')
                .insert({
                batch_code: input.batchCode,
                inventory_item_id: input.inventoryItemId,
                warehouse_id: input.warehouseId,
                location_id: input.locationId ?? null,
                supplier_id: input.supplierId ?? null,
                goods_receipt_id: input.goodsReceiptId ?? null,
                mfg_date: input.mfgDate ?? null,
                expiry_date: input.expiryDate ?? null,
                qty_on_hand: input.qty,
                status: 'active',
                ...costFields,
            })
                .select('*')
                .single();
            throwIfSupabaseError(error, 'Create batch');
            batch = data;
        }
        await supabase.from('stock_movements').insert({
            movement_type: 'grn',
            inventory_item_id: input.inventoryItemId,
            batch_id: batch.id,
            warehouse_id: input.warehouseId,
            location_id: input.locationId ?? null,
            qty: input.qty,
            ref_type: 'goods_receipt',
            ref_id: input.goodsReceiptId ?? null,
            created_by: input.createdBy ?? null,
        });
        return batch;
    },
    /** FEFO: allocate from earliest expiry batches with available qty */
    async reserveStock(input) {
        const need = input.qty;
        if (need <= 0)
            return [];
        const { data: batches, error } = await supabase
            .from('inventory_batches')
            .select('*, warehouse_locations(zone, rack, shelf, bin, location_code)')
            .eq('inventory_item_id', input.inventoryItemId)
            .eq('warehouse_id', input.warehouseId)
            .eq('status', 'active')
            .order('expiry_date', { ascending: true, nullsFirst: false });
        throwIfSupabaseError(error, 'Reserve batches');
        let remaining = need;
        const allocations = [];
        for (const batch of batches ?? []) {
            if (remaining <= 0)
                break;
            const onHand = Number(batch.qty_on_hand) || 0;
            const reserved = Number(batch.qty_reserved) || 0;
            const available = onHand - reserved;
            if (available <= 0)
                continue;
            const take = Math.min(available, remaining);
            const { error: updErr } = await supabase
                .from('inventory_batches')
                .update({
                qty_reserved: reserved + take,
                updated_at: new Date().toISOString(),
            })
                .eq('id', batch.id);
            throwIfSupabaseError(updErr, 'Reserve batch qty');
            const { data: alloc, error: allocErr } = await supabase
                .from('order_line_allocations')
                .insert({
                order_line_id: input.orderLineId,
                batch_id: batch.id,
                location_id: batch.location_id,
                qty_allocated: take,
            })
                .select('*')
                .single();
            throwIfSupabaseError(allocErr, 'Create allocation');
            await supabase.from('stock_movements').insert({
                movement_type: 'reserve',
                inventory_item_id: input.inventoryItemId,
                batch_id: batch.id,
                warehouse_id: input.warehouseId,
                location_id: batch.location_id,
                qty: take,
                ref_type: 'order_line',
                ref_id: input.orderLineId,
            });
            const loc = batch.warehouse_locations;
            allocations.push({
                ...alloc,
                batchCode: batch.batch_code,
                rackLocation: loc ? warehouseService.formatLocationDisplay(loc) : null,
            });
            remaining -= take;
        }
        if (remaining > 0) {
            throw new AppError(`Insufficient stock for item ${input.inventoryItemId} (short by ${remaining})`, 409, 'INSUFFICIENT_STOCK');
        }
        return allocations;
    },
    async findByBarcode(code) {
        const trimmed = code.trim();
        const { data, error } = await supabase
            .from('inventory_items')
            .select('*')
            .or(`barcode.eq.${trimmed},sku.eq.${trimmed}`)
            .limit(1)
            .maybeSingle();
        throwIfSupabaseError(error, 'Find by barcode');
        return data;
    },
    async findBatchByCode(batchCode, inventoryItemId) {
        let q = supabase.from('inventory_batches').select('*').eq('batch_code', batchCode.trim());
        if (inventoryItemId)
            q = q.eq('inventory_item_id', inventoryItemId);
        const { data, error } = await q.limit(1).maybeSingle();
        throwIfSupabaseError(error, 'Find batch');
        return data;
    },
    async releaseOrderAllocations(commerceOrderId, actorEmail) {
        const { data: lines } = await supabase
            .from('commerce_order_lines')
            .select('id')
            .eq('commerce_order_id', commerceOrderId);
        for (const line of lines ?? []) {
            const { data: allocs } = await supabase
                .from('order_line_allocations')
                .select('*, inventory_batches(*)')
                .eq('order_line_id', line.id);
            for (const alloc of allocs ?? []) {
                const batch = alloc.inventory_batches;
                const reserved = Number(batch.qty_reserved) || 0;
                const qty = Number(alloc.qty_allocated) - Number(alloc.qty_packed);
                if (qty <= 0)
                    continue;
                await supabase
                    .from('inventory_batches')
                    .update({
                    qty_reserved: Math.max(0, reserved - qty),
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', alloc.batch_id);
                await supabase.from('stock_movements').insert({
                    movement_type: 'release',
                    inventory_item_id: batch.inventory_item_id,
                    batch_id: alloc.batch_id,
                    warehouse_id: batch.warehouse_id,
                    location_id: alloc.location_id,
                    qty: qty,
                    ref_type: 'commerce_order',
                    ref_id: commerceOrderId,
                    created_by: actorEmail ?? null,
                });
            }
        }
    },
    async processReturnStock(input) {
        const warehouse = await warehouseService.getDefaultWarehouse();
        for (const line of input.lines) {
            if (!line.batchCode || !line.sku)
                continue;
            const { data: item } = await supabase
                .from('inventory_items')
                .select('id')
                .eq('sku', line.sku)
                .maybeSingle();
            if (!item)
                continue;
            const batch = await this.findBatchByCode(line.batchCode, String(item.id));
            if (!batch)
                continue;
            const movementType = input.stockAction === 'writeoff'
                ? 'return_writeoff'
                : input.stockAction === 'damaged'
                    ? 'damage'
                    : 'return_restock';
            const patch = { updated_at: new Date().toISOString() };
            if (input.stockAction === 'resalable') {
                patch.qty_on_hand = Number(batch.qty_on_hand) + line.qty;
                patch.qty_returned = Number(batch.qty_returned) + line.qty;
                patch.status = 'active';
            }
            else if (input.stockAction === 'damaged') {
                patch.qty_damaged = Number(batch.qty_damaged) + line.qty;
                patch.status = 'active';
            }
            else if (input.stockAction === 'quarantine') {
                patch.qty_on_hand = Number(batch.qty_on_hand) + line.qty;
                patch.status = 'quarantine';
            }
            else {
                patch.qty_returned = Number(batch.qty_returned) + line.qty;
            }
            await supabase.from('inventory_batches').update(patch).eq('id', batch.id);
            await supabase.from('stock_movements').insert({
                movement_type: movementType,
                inventory_item_id: item.id,
                batch_id: batch.id,
                warehouse_id: warehouse.id,
                location_id: batch.location_id,
                qty: line.qty,
                ref_type: 'return',
                ref_id: input.commerceOrderId,
                notes: input.stockAction,
                created_by: input.actorEmail ?? null,
            });
        }
    },
    async adjustBatchStock(input) {
        const { data: batch, error } = await supabase
            .from('inventory_batches')
            .select('*')
            .eq('id', input.batchId)
            .single();
        throwIfSupabaseError(error, 'Batch adjust');
        if (!batch)
            throw new NotFoundError('Batch not found');
        const next = Math.max(0, Number(batch.qty_on_hand) + input.adjustment);
        await supabase
            .from('inventory_batches')
            .update({ qty_on_hand: next, updated_at: new Date().toISOString() })
            .eq('id', input.batchId);
        await supabase.from('stock_movements').insert({
            movement_type: 'adjust',
            inventory_item_id: batch.inventory_item_id,
            batch_id: batch.id,
            warehouse_id: batch.warehouse_id,
            location_id: batch.location_id,
            qty: input.adjustment,
            ref_type: 'manual_adjust',
            notes: input.reason,
            created_by: input.actorEmail ?? null,
        });
        return { ...batch, qty_on_hand: next };
    },
    async setBatchStatus(batchId, status) {
        const { data, error } = await supabase
            .from('inventory_batches')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', batchId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Batch status');
        return data;
    },
    async pickAllocation(allocationId, qty) {
        const { data: alloc, error } = await supabase
            .from('order_line_allocations')
            .select('*, inventory_batches(*)')
            .eq('id', allocationId)
            .single();
        throwIfSupabaseError(error, 'Allocation');
        if (!alloc)
            throw new NotFoundError('Allocation not found');
        const picked = Number(alloc.qty_picked) + qty;
        if (picked > Number(alloc.qty_allocated)) {
            throw new AppError('Pick qty exceeds allocation', 400, 'VALIDATION');
        }
        await supabase
            .from('order_line_allocations')
            .update({ qty_picked: picked })
            .eq('id', allocationId);
        const batch = alloc.inventory_batches;
        await supabase.from('stock_movements').insert({
            movement_type: 'pick',
            inventory_item_id: batch.inventory_item_id,
            batch_id: alloc.batch_id,
            warehouse_id: batch.warehouse_id,
            location_id: alloc.location_id,
            qty,
            ref_type: 'allocation',
            ref_id: allocationId,
        });
        return alloc;
    },
    async finalizePack(allocationId) {
        const { data: alloc, error } = await supabase
            .from('order_line_allocations')
            .select('*, inventory_batches(*)')
            .eq('id', allocationId)
            .single();
        throwIfSupabaseError(error, 'Allocation pack');
        if (!alloc)
            throw new NotFoundError('Allocation not found');
        const qty = Number(alloc.qty_allocated);
        const batch = alloc.inventory_batches;
        const onHand = Number(batch.qty_on_hand) || 0;
        const reserved = Number(batch.qty_reserved) || 0;
        await supabase
            .from('inventory_batches')
            .update({
            qty_on_hand: Math.max(0, onHand - qty),
            qty_reserved: Math.max(0, reserved - qty),
            status: onHand - qty <= 0 ? 'depleted' : batch.status,
            updated_at: new Date().toISOString(),
        })
            .eq('id', alloc.batch_id);
        await supabase
            .from('order_line_allocations')
            .update({ qty_packed: qty })
            .eq('id', allocationId);
        await supabase.from('stock_movements').insert({
            movement_type: 'pack',
            inventory_item_id: batch.inventory_item_id,
            batch_id: alloc.batch_id,
            warehouse_id: batch.warehouse_id,
            location_id: alloc.location_id,
            qty: -qty,
            ref_type: 'allocation',
            ref_id: allocationId,
        });
    },
};
//# sourceMappingURL=inventory.service.js.map