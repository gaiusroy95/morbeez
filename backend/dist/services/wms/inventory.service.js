import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { shopifyAdmin } from '../shopify/shopify.client.js';
import { shopifyInventoryService } from '../shopify/shopify.inventory.service.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { warehouseService } from './warehouse.service.js';
const COMMERCE_SYNC_THROTTLE_MS = 12_000;
let lastCommerceWarehouseSyncAt = 0;
function mapBatchRows(itemBatches) {
    let available = 0;
    let reserved = 0;
    let damaged = 0;
    let returned = 0;
    const batches = itemBatches.map((b) => {
        const onHand = Number(b.qty_on_hand) || 0;
        const res = Number(b.qty_reserved) || 0;
        const dmg = Number(b.qty_damaged) || 0;
        const ret = Number(b.qty_returned) || 0;
        available += Math.max(0, onHand - res);
        reserved += res;
        damaged += dmg;
        returned += ret;
        const loc = b.warehouse_locations ?? null;
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
    return { available, reserved, damaged, returned, batches };
}
function mapInventoryItemRow(row) {
    return {
        id: String(row.id),
        sku: String(row.sku),
        productTitle: String(row.product_title),
    };
}
function isVarSku(sku) {
    return /^VAR-\d+$/i.test(sku.trim());
}
function effectiveVariantIdFromItem(item) {
    if (item.shopify_variant_id?.trim())
        return String(item.shopify_variant_id).trim();
    const match = item.sku?.trim().match(/^VAR-(\d+)$/i);
    return match ? match[1] : null;
}
function pickCanonicalInventoryItem(items) {
    return [...items].sort((a, b) => {
        const aVar = isVarSku(a.sku) ? 1 : 0;
        const bVar = isVarSku(b.sku) ? 1 : 0;
        if (aVar !== bVar)
            return aVar - bVar;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })[0];
}
function catalogVariantLabel(variant) {
    return (variant.option1 ||
        `${variant.packSize || ''} ${variant.unit || ''}`.trim() ||
        variant.title ||
        'Default');
}
function catalogDisplayTitle(product, variant) {
    const label = catalogVariantLabel(variant);
    return label && label !== 'Default' ? `${product.title} — ${label}` : product.title;
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
        const sku = input.sku.trim();
        const variantFromSku = this.extractVariantIdFromSku(sku);
        const variantId = input.shopifyVariantId?.trim() || variantFromSku || null;
        const preferCanonicalSku = sku && !isVarSku(sku);
        /** One Shopify variant must map to one inventory_items row (orders use VAR-* SKUs). */
        if (variantId) {
            let byVariant = null;
            const { data: byVariantCol } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('shopify_variant_id', variantId)
                .eq('active', true)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            byVariant = byVariantCol ?? null;
            if (!byVariant) {
                const { data: byVarSku } = await supabase
                    .from('inventory_items')
                    .select('*')
                    .eq('sku', `VAR-${variantId}`)
                    .eq('active', true)
                    .maybeSingle();
                byVariant = byVarSku ?? null;
            }
            if (byVariant) {
                const nextSku = preferCanonicalSku && byVariant.sku !== sku
                    ? sku
                    : String(byVariant.sku);
                const { data, error } = await supabase
                    .from('inventory_items')
                    .update({
                    sku: nextSku,
                    product_title: input.productTitle,
                    shopify_variant_id: variantId,
                    barcode: input.barcode ?? byVariant.barcode,
                    hsn_code: input.hsnCode ?? byVariant.hsn_code,
                    gst_percent: input.gstPercent ?? byVariant.gst_percent,
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', byVariant.id)
                    .select('*')
                    .single();
                throwIfSupabaseError(error, 'Update inventory item by variant');
                return data;
            }
        }
        const { data: existing } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('sku', sku)
            .maybeSingle();
        if (existing) {
            const { data, error } = await supabase
                .from('inventory_items')
                .update({
                product_title: input.productTitle,
                shopify_variant_id: variantId ?? existing.shopify_variant_id,
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
            sku,
            product_title: input.productTitle,
            shopify_variant_id: variantId,
            barcode: input.barcode ?? null,
            hsn_code: input.hsnCode ?? null,
            gst_percent: input.gstPercent ?? 18,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Insert inventory item');
        return data;
    },
    async resolveCanonicalInventoryItemId(inventoryItemId) {
        const { data: item, error } = await supabase
            .from('inventory_items')
            .select('id, sku, shopify_variant_id, product_title, created_at')
            .eq('id', inventoryItemId)
            .eq('active', true)
            .maybeSingle();
        throwIfSupabaseError(error, 'Resolve canonical inventory item');
        if (!item)
            return inventoryItemId;
        const variantId = effectiveVariantIdFromItem(item);
        if (!variantId)
            return inventoryItemId;
        const peerIds = await this.listInventoryItemIdsForVariant(variantId);
        if (peerIds.length <= 1)
            return inventoryItemId;
        const { data: peers, error: peerErr } = await supabase
            .from('inventory_items')
            .select('id, sku, shopify_variant_id, product_title, created_at')
            .in('id', peerIds)
            .eq('active', true);
        throwIfSupabaseError(peerErr, 'Load peer inventory items');
        if (!peers?.length)
            return inventoryItemId;
        return pickCanonicalInventoryItem(peers).id;
    },
    async ensureInventoryItemForVariant(variantId) {
        const existingIds = await this.listInventoryItemIdsForVariant(variantId);
        if (existingIds.length) {
            return this.resolveCanonicalInventoryItemId(existingIds[0]);
        }
        let sku = `VAR-${variantId}`;
        let title = `Variant ${variantId}`;
        try {
            const { variant } = await shopifyAdmin(`/variants/${variantId}.json`);
            const { product } = await shopifyAdmin(`/products/${variant.product_id}.json?fields=id,title`);
            sku = (variant.sku || sku).trim();
            const variantLabel = variant.title && variant.title !== 'Default Title' ? ` — ${variant.title}` : '';
            title = `${product.title}${variantLabel}`;
        }
        catch (err) {
            logger.debug({ err, variantId }, 'Shopify variant lookup for inventory item skipped');
        }
        const item = await this.upsertItemFromSku({
            sku,
            productTitle: title,
            shopifyVariantId: variantId,
        });
        return String(item.id);
    },
    async repointInventoryItemReferences(fromId, toId) {
        if (fromId === toId)
            return;
        const tables = [
            'commerce_order_lines',
            'purchase_order_lines',
            'pick_list_lines',
            'stock_movements',
        ];
        for (const table of tables) {
            const { error } = await supabase
                .from(table)
                .update({ inventory_item_id: toId })
                .eq('inventory_item_id', fromId);
            throwIfSupabaseError(error, `Repoint ${table} inventory item`);
        }
        const { error: tierErr } = await supabase
            .from('pricing_tiers')
            .update({ inventory_item_id: toId })
            .eq('inventory_item_id', fromId);
        throwIfSupabaseError(tierErr, 'Repoint pricing tier inventory item');
    },
    async mergeDuplicateInventoryItem(fromId, toId) {
        if (fromId === toId)
            return;
        const warehouse = await warehouseService.getDefaultWarehouse();
        const { data: dupBatches, error } = await supabase
            .from('inventory_batches')
            .select('*')
            .eq('inventory_item_id', fromId)
            .eq('warehouse_id', warehouse.id);
        throwIfSupabaseError(error, 'Load duplicate inventory batches');
        for (const dup of dupBatches ?? []) {
            const batchCode = String(dup.batch_code);
            const { data: canonicalBatch } = await supabase
                .from('inventory_batches')
                .select('*')
                .eq('inventory_item_id', toId)
                .eq('warehouse_id', warehouse.id)
                .eq('batch_code', batchCode)
                .maybeSingle();
            const dupReserved = Number(dup.qty_reserved) || 0;
            const dupOnHand = Number(dup.qty_on_hand) || 0;
            if (canonicalBatch) {
                if (dupReserved > 0) {
                    await supabase
                        .from('inventory_batches')
                        .update({
                        qty_reserved: (Number(canonicalBatch.qty_reserved) || 0) + dupReserved,
                        updated_at: new Date().toISOString(),
                    })
                        .eq('id', canonicalBatch.id);
                    await supabase
                        .from('pick_list_lines')
                        .update({ batch_id: canonicalBatch.id })
                        .eq('batch_id', dup.id);
                }
                await supabase
                    .from('inventory_batches')
                    .update({
                    qty_on_hand: 0,
                    qty_reserved: 0,
                    status: 'depleted',
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', dup.id);
            }
            else if (dupReserved > 0 || dupOnHand > 0) {
                await supabase
                    .from('inventory_batches')
                    .update({
                    inventory_item_id: toId,
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', dup.id);
            }
            else {
                await supabase
                    .from('inventory_batches')
                    .update({
                    qty_on_hand: 0,
                    qty_reserved: 0,
                    status: 'depleted',
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', dup.id);
            }
        }
        await this.repointInventoryItemReferences(fromId, toId);
        await supabase
            .from('inventory_items')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', fromId);
    },
    async dedupeInventoryItemsByVariant() {
        const { data: items, error } = await supabase
            .from('inventory_items')
            .select('id, sku, shopify_variant_id, product_title, created_at')
            .eq('active', true);
        throwIfSupabaseError(error, 'Load inventory items for dedupe');
        const groups = new Map();
        for (const row of (items ?? [])) {
            const variantId = effectiveVariantIdFromItem(row);
            if (!variantId)
                continue;
            const list = groups.get(variantId) ?? [];
            list.push(row);
            groups.set(variantId, list);
        }
        let merged = 0;
        for (const [, peers] of groups) {
            if (peers.length <= 1)
                continue;
            const canonical = pickCanonicalInventoryItem(peers);
            for (const peer of peers) {
                if (peer.id === canonical.id)
                    continue;
                await this.mergeDuplicateInventoryItem(peer.id, canonical.id);
                merged += 1;
            }
            if (!canonical.shopify_variant_id) {
                await supabase
                    .from('inventory_items')
                    .update({
                    shopify_variant_id: effectiveVariantIdFromItem(canonical),
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', canonical.id);
            }
        }
        return { merged, variantGroups: groups.size };
    },
    async loadCommerceVariantIds() {
        const { data, error } = await supabase.from('commerce_stock_batches').select('shopify_variant_id');
        throwIfSupabaseError(error, 'Load commerce variant ids');
        return new Set((data ?? [])
            .map((row) => (row.shopify_variant_id ? String(row.shopify_variant_id).trim() : ''))
            .filter(Boolean));
    },
    async loadCommerceBatchesByVariant() {
        const { data, error } = await supabase
            .from('commerce_stock_batches')
            .select('shopify_variant_id, batch_code, qty')
            .order('expiry_date', { ascending: true, nullsFirst: false });
        throwIfSupabaseError(error, 'Load commerce stock batches');
        const map = new Map();
        for (const row of data ?? []) {
            const key = String(row.shopify_variant_id).trim();
            const list = map.get(key) ?? [];
            list.push({
                batchCode: String(row.batch_code),
                qty: Number(row.qty) || 0,
            });
            map.set(key, list);
        }
        return map;
    },
    async ensureCommerceLinkedItem(variantId, catalogEntry) {
        const itemId = await this.ensureInventoryItemForVariant(variantId);
        if (!catalogEntry)
            return itemId;
        const title = catalogDisplayTitle(catalogEntry.product, catalogEntry.variant);
        const sku = (catalogEntry.variant.sku || catalogEntry.product.sku || `VAR-${variantId}`).trim();
        const { error } = await supabase
            .from('inventory_items')
            .update({
            product_title: title,
            sku,
            shopify_variant_id: variantId,
            updated_at: new Date().toISOString(),
        })
            .eq('id', itemId);
        throwIfSupabaseError(error, 'Align inventory item with commerce catalog');
        return itemId;
    },
    extractVariantIdFromSku(sku) {
        if (!sku?.trim())
            return null;
        const match = sku.trim().match(/^VAR-(\d+)$/i);
        return match ? match[1] : null;
    },
    async listInventoryItemIdsForVariant(variantId) {
        const { data, error } = await supabase
            .from('inventory_items')
            .select('id')
            .eq('shopify_variant_id', variantId)
            .eq('active', true);
        throwIfSupabaseError(error, 'List items by variant');
        return (data ?? []).map((row) => String(row.id));
    },
    async getAvailableWarehouseQty(inventoryItemId, warehouseId) {
        const { data: batches, error } = await supabase
            .from('inventory_batches')
            .select('qty_on_hand, qty_reserved')
            .eq('inventory_item_id', inventoryItemId)
            .eq('warehouse_id', warehouseId)
            .eq('status', 'active');
        throwIfSupabaseError(error, 'Warehouse availability');
        return (batches ?? []).reduce((sum, b) => sum + Math.max(0, Number(b.qty_on_hand) - Number(b.qty_reserved)), 0);
    },
    /**
     * Order lines often point at VAR-{variantId} items while Add Stock created a second row with the real SKU.
     * Pick the inventory_items row that actually has warehouse stock after commerce sync.
     */
    async resolveInventoryItemForOrderLine(line) {
        if (!line.inventory_item_id) {
            throw new AppError(`Order line "${line.product_title}" has no inventory SKU — sync order lines first`, 409, 'ORDER_LINE_NO_SKU');
        }
        const warehouse = await warehouseService.getDefaultWarehouse();
        const candidateIds = new Set([String(line.inventory_item_id)]);
        const { data: current, error: curErr } = await supabase
            .from('inventory_items')
            .select('id, sku, shopify_variant_id')
            .eq('id', line.inventory_item_id)
            .eq('active', true)
            .maybeSingle();
        throwIfSupabaseError(curErr, 'Order line inventory item');
        const variantIds = new Set();
        if (current?.shopify_variant_id)
            variantIds.add(String(current.shopify_variant_id));
        const fromCurrentSku = this.extractVariantIdFromSku(current?.sku ?? null);
        if (fromCurrentSku)
            variantIds.add(fromCurrentSku);
        const fromLineSku = this.extractVariantIdFromSku(line.sku);
        if (fromLineSku)
            variantIds.add(fromLineSku);
        for (const variantId of variantIds) {
            for (const id of await this.listInventoryItemIdsForVariant(variantId)) {
                candidateIds.add(id);
            }
        }
        if (line.sku?.trim() && !/^VAR-\d+$/i.test(line.sku.trim())) {
            const { data: bySku } = await supabase
                .from('inventory_items')
                .select('id')
                .eq('sku', line.sku.trim())
                .eq('active', true);
            for (const row of bySku ?? [])
                candidateIds.add(String(row.id));
        }
        let bestId = String(line.inventory_item_id);
        let bestAvailable = -1;
        for (const id of candidateIds) {
            await this.syncCommerceBatchesToWarehouse(id, { shopifyFallback: false });
            const available = await this.getAvailableWarehouseQty(id, String(warehouse.id));
            if (available > bestAvailable) {
                bestAvailable = available;
                bestId = id;
            }
        }
        if (bestId !== String(line.inventory_item_id)) {
            await supabase
                .from('commerce_order_lines')
                .update({
                inventory_item_id: bestId,
                updated_at: new Date().toISOString(),
            })
                .eq('id', line.id);
        }
        return { inventoryItemId: bestId, available: Math.max(0, bestAvailable) };
    },
    async ensureCommerceStockSynced(force = false) {
        const now = Date.now();
        if (!force && now - lastCommerceWarehouseSyncAt < COMMERCE_SYNC_THROTTLE_MS)
            return;
        lastCommerceWarehouseSyncAt = now;
        try {
            await this.dedupeInventoryItemsByVariant();
            await this.syncAllCommerceStockToWarehouse();
        }
        catch (err) {
            logger.warn({ err }, 'Commerce → warehouse stock sync skipped');
        }
    },
    async getStockSummary(opts) {
        if (opts?.sync !== false) {
            await this.ensureCommerceStockSynced(opts?.forceSync === true);
        }
        const warehouse = opts?.warehouseId
            ? { id: opts.warehouseId }
            : await warehouseService.getDefaultWarehouse();
        const [commerceBatchesByVariant, catalog] = await Promise.all([
            this.loadCommerceBatchesByVariant(),
            shopifyProductsService.getInventoryCatalog(opts?.search),
        ]);
        const catalogByVariantId = new Map();
        const variantIds = new Set(commerceBatchesByVariant.keys());
        for (const product of catalog) {
            const variants = product.variants?.length
                ? product.variants
                : [
                    {
                        id: product.id,
                        sku: product.sku ?? '',
                        option1: 'Default',
                        packSize: '',
                        unit: '',
                        title: 'Default',
                        inventory: product.inventory ?? 0,
                    },
                ];
            for (const variant of variants) {
                catalogByVariantId.set(variant.id, { product, variant });
                const hasCommerceBatches = commerceBatchesByVariant.has(variant.id);
                const shopifyStock = Number(variant.inventory ?? product.inventory ?? 0) || 0;
                if (hasCommerceBatches || shopifyStock > 0) {
                    variantIds.add(variant.id);
                }
            }
        }
        const itemIdByVariant = new Map();
        for (const variantId of variantIds) {
            const catalogEntry = catalogByVariantId.get(variantId) ?? null;
            const itemId = await this.ensureCommerceLinkedItem(variantId, catalogEntry);
            itemIdByVariant.set(variantId, itemId);
            await this.syncCommerceBatchesToWarehouse(itemId, {
                shopifyFallback: !commerceBatchesByVariant.has(variantId),
            });
        }
        const itemIds = [...new Set(itemIdByVariant.values())];
        if (!itemIds.length)
            return [];
        const { data: itemRows, error: itemRowsErr } = await supabase
            .from('inventory_items')
            .select('id, sku, product_title')
            .in('id', itemIds);
        throwIfSupabaseError(itemRowsErr, 'Load linked inventory items');
        const itemMetaById = new Map((itemRows ?? []).map((row) => [
            String(row.id),
            { sku: String(row.sku), productTitle: String(row.product_title) },
        ]));
        const { data: batches, error: batchErr } = await supabase
            .from('inventory_batches')
            .select('*, warehouse_locations(zone, rack, shelf, bin, location_code)')
            .eq('warehouse_id', warehouse.id)
            .in('inventory_item_id', itemIds)
            .neq('status', 'depleted');
        throwIfSupabaseError(batchErr, 'Stock batches');
        const { data: poLines } = await supabase
            .from('purchase_order_lines')
            .select('inventory_item_id, qty_ordered, qty_received, purchase_orders!inner(status)')
            .in('inventory_item_id', itemIds)
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
        const searchTerm = opts?.search?.trim().toLowerCase() ?? '';
        const rows = [];
        for (const [variantId, itemId] of itemIdByVariant) {
            const catalogEntry = catalogByVariantId.get(variantId);
            const commerceBatches = commerceBatchesByVariant.get(variantId) ?? [];
            const itemBatches = (batchesByItem.get(itemId) ?? []);
            const totals = mapBatchRows(itemBatches);
            const incoming = incomingByItem.get(itemId) ?? 0;
            const activity = totals.available + totals.reserved + totals.damaged + totals.returned + incoming;
            if (!commerceBatches.length && activity === 0)
                continue;
            const fallbackMeta = itemMetaById.get(itemId);
            const productTitle = catalogEntry
                ? catalogDisplayTitle(catalogEntry.product, catalogEntry.variant)
                : fallbackMeta?.productTitle ?? 'Product';
            const sku = catalogEntry
                ? (catalogEntry.variant.sku || catalogEntry.product.sku || `VAR-${variantId}`).trim()
                : fallbackMeta?.sku ?? `VAR-${variantId}`;
            if (searchTerm) {
                const hay = `${productTitle} ${sku}`.toLowerCase();
                if (!hay.includes(searchTerm))
                    continue;
            }
            rows.push({
                inventoryItemId: itemId,
                sku,
                productTitle,
                available: totals.available,
                reserved: totals.reserved,
                damaged: totals.damaged,
                returned: totals.returned,
                incoming,
                batches: totals.batches,
            });
        }
        return rows.sort((a, b) => a.productTitle.localeCompare(b.productTitle));
    },
    async getStockItemDetail(inventoryItemId, opts) {
        await this.syncCommerceBatchesToWarehouse(inventoryItemId);
        const warehouse = opts?.warehouseId
            ? { id: opts.warehouseId }
            : await warehouseService.getDefaultWarehouse();
        const { data: item, error: itemErr } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('id', inventoryItemId)
            .eq('active', true)
            .maybeSingle();
        throwIfSupabaseError(itemErr, 'Stock item');
        if (!item)
            throw new NotFoundError('Inventory item not found');
        const { data: itemBatches, error: batchErr } = await supabase
            .from('inventory_batches')
            .select('*, warehouse_locations(zone, rack, shelf, bin, location_code)')
            .eq('warehouse_id', warehouse.id)
            .eq('inventory_item_id', inventoryItemId)
            .neq('status', 'depleted');
        throwIfSupabaseError(batchErr, 'Stock batches');
        const { data: poLines } = await supabase
            .from('purchase_order_lines')
            .select('qty_ordered, qty_received, purchase_orders!inner(status)')
            .eq('inventory_item_id', inventoryItemId)
            .in('purchase_orders.status', ['sent', 'partial']);
        let incoming = 0;
        for (const line of poLines ?? []) {
            const ordered = Number(line.qty_ordered) || 0;
            const received = Number(line.qty_received) || 0;
            incoming += Math.max(0, ordered - received);
        }
        const totals = mapBatchRows((itemBatches ?? []));
        return {
            inventoryItemId: String(item.id),
            sku: String(item.sku),
            productTitle: String(item.product_title),
            available: totals.available,
            reserved: totals.reserved,
            damaged: totals.damaged,
            returned: totals.returned,
            incoming,
            batches: totals.batches,
        };
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
                if (qty <= 0) {
                    await supabase.from('order_line_allocations').delete().eq('id', alloc.id);
                    continue;
                }
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
                await supabase.from('order_line_allocations').delete().eq('id', alloc.id);
            }
            await supabase
                .from('commerce_order_lines')
                .update({ qty_allocated: 0, updated_at: new Date().toISOString() })
                .eq('id', line.id);
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
    async applyCommerceBatchToWarehouse(inventoryItemId, warehouseId, cb) {
        const commerceQty = Math.max(0, Number(cb.qty) || 0);
        const batchCode = String(cb.batch_code);
        const { data: whBatch } = await supabase
            .from('inventory_batches')
            .select('*')
            .eq('inventory_item_id', inventoryItemId)
            .eq('warehouse_id', warehouseId)
            .eq('batch_code', batchCode)
            .maybeSingle();
        const whOnHand = Number(whBatch?.qty_on_hand) || 0;
        const whReserved = Number(whBatch?.qty_reserved) || 0;
        const targetOnHand = commerceQty + whReserved;
        if (!whBatch) {
            if (commerceQty <= 0)
                return 0;
            await this.createBatchFromGrn({
                inventoryItemId,
                warehouseId,
                batchCode,
                mfgDate: cb.mfg_date ? String(cb.mfg_date) : null,
                expiryDate: cb.expiry_date ? String(cb.expiry_date) : null,
                qty: commerceQty,
            });
            return commerceQty;
        }
        if (targetOnHand === whOnHand)
            return 0;
        const delta = targetOnHand - whOnHand;
        await supabase
            .from('inventory_batches')
            .update({
            qty_on_hand: targetOnHand,
            status: targetOnHand > 0 || whReserved > 0 ? 'active' : 'depleted',
            updated_at: new Date().toISOString(),
        })
            .eq('id', whBatch.id);
        await supabase.from('stock_movements').insert({
            movement_type: 'adjust',
            inventory_item_id: inventoryItemId,
            batch_id: whBatch.id,
            warehouse_id: warehouseId,
            location_id: whBatch.location_id,
            qty: delta,
            ref_type: 'commerce_stock_sync',
            ref_id: String(cb.id),
            notes: 'Synced from commerce inventory',
        });
        return Math.abs(delta);
    },
    async loadCommerceBatchesForItem(item) {
        const variantIds = new Set();
        if (item.shopify_variant_id)
            variantIds.add(String(item.shopify_variant_id).trim());
        if (item.sku?.trim()) {
            const { data: peers } = await supabase
                .from('inventory_items')
                .select('shopify_variant_id')
                .eq('sku', item.sku.trim())
                .eq('active', true)
                .not('shopify_variant_id', 'is', null);
            for (const peer of peers ?? []) {
                if (peer.shopify_variant_id)
                    variantIds.add(String(peer.shopify_variant_id).trim());
            }
        }
        const batches = [];
        for (const variantId of variantIds) {
            const { data, error } = await supabase
                .from('commerce_stock_batches')
                .select('*')
                .eq('shopify_variant_id', variantId);
            throwIfSupabaseError(error, 'Commerce stock batches');
            batches.push(...(data ?? []));
        }
        return { batches, variantIds: [...variantIds] };
    },
    async collectLinkedInventoryItemIds(item) {
        const ids = new Set([item.id]);
        const { variantIds } = await this.loadCommerceBatchesForItem(item);
        for (const variantId of variantIds) {
            for (const id of await this.listInventoryItemIdsForVariant(variantId)) {
                ids.add(id);
            }
        }
        const fromSku = this.extractVariantIdFromSku(item.sku);
        if (fromSku) {
            for (const id of await this.listInventoryItemIdsForVariant(fromSku)) {
                ids.add(id);
            }
        }
        return [...ids];
    },
    /**
     * Mirror commerce_stock_batches (and Shopify catalog qty as fallback) into WMS inventory_batches.
     * Applies to every inventory_items row sharing the same Shopify variant (fixes VAR-* duplicates).
     */
    async syncCommerceBatchesToWarehouse(inventoryItemId, opts) {
        const { data: item, error: itemErr } = await supabase
            .from('inventory_items')
            .select('id, sku, product_title, shopify_variant_id')
            .eq('id', inventoryItemId)
            .eq('active', true)
            .maybeSingle();
        throwIfSupabaseError(itemErr, 'Inventory item for commerce sync');
        if (!item)
            return { syncedQty: 0 };
        const warehouse = await warehouseService.getDefaultWarehouse();
        const { batches: commerceBatches, variantIds } = await this.loadCommerceBatchesForItem(item);
        const canonicalId = await this.resolveCanonicalInventoryItemId(inventoryItemId);
        const targetIds = [canonicalId];
        let commerceSource = [...commerceBatches];
        if (!commerceSource.length && opts?.shopifyFallback !== false) {
            const variantId = variantIds[0] ?? item.shopify_variant_id;
            const variantNum = variantId ? Number(variantId) : NaN;
            if (Number.isFinite(variantNum) && variantNum > 0) {
                try {
                    const shopifyQty = await shopifyInventoryService.getVariantStock(variantNum);
                    if (shopifyQty > 0) {
                        commerceSource = [
                            {
                                id: `shopify-${variantId}`,
                                batch_code: `CATALOG-${variantId}`,
                                qty: shopifyQty,
                                mfg_date: null,
                                expiry_date: null,
                            },
                        ];
                    }
                }
                catch (err) {
                    logger.debug({ err, inventoryItemId, variantId }, 'Shopify stock fallback skipped');
                }
            }
        }
        let syncedQty = 0;
        for (const targetId of targetIds) {
            for (const cb of commerceSource) {
                syncedQty += await this.applyCommerceBatchToWarehouse(targetId, String(warehouse.id), cb);
            }
        }
        if (!item.shopify_variant_id && variantIds[0]) {
            await supabase
                .from('inventory_items')
                .update({
                shopify_variant_id: variantIds[0],
                updated_at: new Date().toISOString(),
            })
                .eq('id', inventoryItemId);
        }
        return { syncedQty };
    },
    /** Push all commerce_stock_batches into the default warehouse (one-time / queue repair). */
    async syncAllCommerceStockToWarehouse() {
        const { data: batches, error } = await supabase
            .from('commerce_stock_batches')
            .select('shopify_variant_id');
        throwIfSupabaseError(error, 'Load commerce batches');
        const variantIds = [
            ...new Set((batches ?? []).map((b) => String(b.shopify_variant_id).trim()).filter(Boolean)),
        ];
        let syncedVariants = 0;
        let syncedQty = 0;
        const syncedItemIds = new Set();
        for (const variantId of variantIds) {
            let itemIds = await this.listInventoryItemIdsForVariant(variantId);
            if (!itemIds.length) {
                const createdId = await this.ensureInventoryItemForVariant(variantId);
                itemIds = [createdId];
            }
            const canonicalId = await this.resolveCanonicalInventoryItemId(itemIds[0]);
            if (syncedItemIds.has(canonicalId))
                continue;
            syncedItemIds.add(canonicalId);
            const result = await this.syncCommerceBatchesToWarehouse(canonicalId, {
                shopifyFallback: false,
            });
            if (result.syncedQty > 0)
                syncedQty += result.syncedQty;
            syncedVariants += 1;
        }
        return { syncedVariants, syncedQty, variantCount: variantIds.length };
    },
};
//# sourceMappingURL=inventory.service.js.map