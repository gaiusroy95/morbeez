import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { shopifyInventoryService } from '../shopify/shopify.inventory.service.js';
const LOW_STOCK_THRESHOLD = 10;
function stockStatus(qty) {
    if (qty <= 0)
        return 'out_of_stock';
    if (qty <= LOW_STOCK_THRESHOLD)
        return 'low_stock';
    return 'in_stock';
}
function stableBatch(productId, variantId, sku) {
    if (sku?.trim()) {
        const clean = sku.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (clean.length >= 4)
            return clean.slice(0, 10);
    }
    const n = Math.abs(Number(variantId) || 0) + Number(productId) * 7;
    return `BC${String(n % 1000000).padStart(6, '0')}`;
}
function defaultExpiry(variantId) {
    const base = new Date();
    base.setFullYear(base.getFullYear() + 2);
    const seed = Number(variantId) % 180;
    base.setDate(base.getDate() + seed);
    return formatDate(base);
}
function formatDate(value) {
    if (!value)
        return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function variantLabel(_product, variant) {
    return (variant.option1 ||
        `${variant.packSize || ''} ${variant.unit || ''}`.trim() ||
        variant.title ||
        'Default');
}
function mapBatchRow(row) {
    return {
        id: String(row.id),
        batchCode: String(row.batch_code),
        mfgDate: row.mfg_date ? String(row.mfg_date) : null,
        expiryDate: row.expiry_date ? String(row.expiry_date) : null,
        qty: Number(row.qty) || 0,
    };
}
async function loadBatchesByVariant() {
    const { data, error } = await supabase
        .from('commerce_stock_batches')
        .select('*')
        .order('expiry_date', { ascending: true, nullsFirst: false });
    throwIfSupabaseError(error, 'Load commerce stock batches');
    const map = new Map();
    for (const row of data ?? []) {
        const key = String(row.shopify_variant_id);
        const list = map.get(key) ?? [];
        list.push(mapBatchRow(row));
        map.set(key, list);
    }
    return map;
}
function findVariantInCatalog(catalog, opts) {
    const sku = opts.sku?.trim().toLowerCase();
    const barcode = opts.barcode?.trim().toLowerCase();
    const variantId = opts.variantId?.trim();
    const productId = opts.productId?.trim();
    for (const product of catalog) {
        if (productId && product.id !== productId)
            continue;
        const variants = product.variants?.length ? product.variants : [];
        if (!variants.length) {
            if (variantId && product.id === variantId)
                return { product, variant: product.variants?.[0] ?? { id: product.id, title: 'Default', option1: 'Default', packSize: '', unit: '', price: product.price ?? '0', mrp: product.price ?? '0', sku: product.sku ?? '', inventory: product.inventory ?? 0 } };
            if (sku && product.sku?.toLowerCase() === sku) {
                return {
                    product,
                    variant: {
                        id: product.id,
                        title: 'Default',
                        option1: 'Default',
                        packSize: '',
                        unit: '',
                        price: product.price ?? '0',
                        mrp: product.price ?? '0',
                        sku: product.sku ?? '',
                        inventory: product.inventory ?? 0,
                    },
                };
            }
            continue;
        }
        for (const variant of variants) {
            if (variantId && variant.id === variantId)
                return { product, variant };
            if (sku && variant.sku?.toLowerCase() === sku)
                return { product, variant };
            if (barcode && variant.sku?.toLowerCase() === barcode)
                return { product, variant };
        }
    }
    return null;
}
async function resolveBarcodeVariantId(barcode) {
    const code = barcode.trim();
    if (!code)
        return null;
    const { data, error } = await supabase
        .from('inventory_items')
        .select('shopify_variant_id')
        .or(`barcode.eq.${code},sku.eq.${code}`)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
    throwIfSupabaseError(error, 'Barcode lookup');
    return data?.shopify_variant_id ? String(data.shopify_variant_id) : null;
}
export const inventoryAdminService = {
    async list(query) {
        const limit = Math.min(100, Math.max(8, query.limit ?? 8));
        const page = Math.max(1, query.page ?? 1);
        const [catalog, batchesByVariant] = await Promise.all([
            shopifyProductsService.getInventoryCatalog(query.search),
            loadBatchesByVariant(),
        ]);
        const allRows = [];
        for (const product of catalog) {
            const variants = product.variants?.length ? product.variants : [];
            if (!variants.length) {
                const stock = product.inventory ?? 0;
                const price = Number(product.price || 0);
                const status = stockStatus(stock);
                const saved = batchesByVariant.get(product.id);
                if (saved?.length) {
                    for (const batch of saved) {
                        const batchStock = batch.qty;
                        allRows.push({
                            productId: product.id,
                            variantId: product.id,
                            title: product.title,
                            imageUrl: product.imageUrl,
                            variant: 'Default',
                            batchNo: batch.batchCode,
                            mfgDate: formatDate(batch.mfgDate),
                            expiryDate: formatDate(batch.expiryDate),
                            stock: batchStock,
                            status: stockStatus(batchStock),
                            unitValueInr: price * batchStock,
                        });
                    }
                }
                else {
                    allRows.push({
                        productId: product.id,
                        variantId: product.id,
                        title: product.title,
                        imageUrl: product.imageUrl,
                        variant: 'Default',
                        batchNo: stableBatch(product.id, product.id, product.sku),
                        mfgDate: '—',
                        expiryDate: defaultExpiry(product.id),
                        stock,
                        status,
                        unitValueInr: price * Math.max(0, stock),
                    });
                }
                continue;
            }
            for (const v of variants) {
                const stock = v.inventory ?? 0;
                const price = Number(v.price || product.price || 0);
                const label = variantLabel(product, v);
                const saved = batchesByVariant.get(v.id);
                if (saved?.length) {
                    for (const batch of saved) {
                        const batchStock = batch.qty;
                        allRows.push({
                            productId: product.id,
                            variantId: v.id,
                            title: product.title,
                            imageUrl: product.imageUrl,
                            variant: label,
                            batchNo: batch.batchCode,
                            mfgDate: formatDate(batch.mfgDate),
                            expiryDate: formatDate(batch.expiryDate),
                            stock: batchStock,
                            status: stockStatus(batchStock),
                            unitValueInr: price * batchStock,
                        });
                    }
                }
                else {
                    allRows.push({
                        productId: product.id,
                        variantId: v.id,
                        title: product.title,
                        imageUrl: product.imageUrl,
                        variant: label,
                        batchNo: stableBatch(product.id, v.id, v.sku),
                        mfgDate: '—',
                        expiryDate: defaultExpiry(v.id),
                        stock,
                        status: stockStatus(stock),
                        unitValueInr: price * Math.max(0, stock),
                    });
                }
            }
        }
        let totalStock = 0;
        let totalStockValue = 0;
        const productIdsLow = new Set();
        const productIdsOut = new Set();
        for (const product of catalog) {
            const variants = product.variants?.length ? product.variants : [];
            if (!variants.length) {
                const stock = product.inventory ?? 0;
                const price = Number(product.price || 0);
                totalStock += Math.max(0, stock);
                totalStockValue += price * Math.max(0, stock);
                const status = stockStatus(stock);
                if (status === 'low_stock')
                    productIdsLow.add(product.id);
                if (status === 'out_of_stock')
                    productIdsOut.add(product.id);
                continue;
            }
            for (const v of variants) {
                const stock = v.inventory ?? 0;
                const price = Number(v.price || product.price || 0);
                totalStock += Math.max(0, stock);
                totalStockValue += price * Math.max(0, stock);
                const status = stockStatus(stock);
                if (status === 'low_stock')
                    productIdsLow.add(product.id);
                if (status === 'out_of_stock')
                    productIdsOut.add(product.id);
            }
        }
        const rows = query.status && query.status !== 'all'
            ? allRows.filter((r) => r.status === query.status)
            : allRows;
        const total = rows.length;
        const pages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, pages);
        const start = (safePage - 1) * limit;
        return {
            rows: rows.slice(start, start + limit),
            stats: {
                totalStockValue: Math.round(totalStockValue),
                totalStock,
                lowStockProducts: productIdsLow.size,
                outOfStockProducts: productIdsOut.size,
            },
            pagination: { page: safePage, limit, total, pages },
        };
    },
    async lookup(input) {
        const catalog = await shopifyProductsService.getInventoryCatalog();
        let variantId = input.variantId?.trim();
        if (!variantId && input.barcode?.trim()) {
            variantId = (await resolveBarcodeVariantId(input.barcode)) ?? undefined;
        }
        const match = findVariantInCatalog(catalog, {
            variantId,
            productId: input.productId,
            sku: input.sku,
            barcode: input.barcode,
        });
        if (!match)
            throw new NotFoundError('No product variant found for that SKU or barcode');
        const { product, variant } = match;
        const currentStock = await shopifyInventoryService.getVariantStock(Number(variant.id));
        const { data: batchRows, error } = await supabase
            .from('commerce_stock_batches')
            .select('*')
            .eq('shopify_variant_id', variant.id)
            .order('expiry_date', { ascending: true, nullsFirst: false });
        throwIfSupabaseError(error, 'Load variant batches');
        let barcode = null;
        const { data: itemRow } = await supabase
            .from('inventory_items')
            .select('barcode')
            .eq('shopify_variant_id', variant.id)
            .eq('active', true)
            .maybeSingle();
        if (itemRow?.barcode)
            barcode = String(itemRow.barcode);
        return {
            productId: product.id,
            variantId: variant.id,
            title: product.title,
            variant: variantLabel(product, variant),
            sku: variant.sku || product.sku || '',
            barcode,
            currentStock,
            batches: (batchRows ?? []).map((row) => mapBatchRow(row)),
        };
    },
    async addIncomingStock(input) {
        const qty = Math.floor(Number(input.qty));
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new ValidationError('New stock quantity must be greater than zero');
        }
        const batchCode = input.batchCode.trim();
        if (!batchCode)
            throw new ValidationError('Batch number is required');
        const catalog = await shopifyProductsService.getInventoryCatalog();
        const match = findVariantInCatalog(catalog, { variantId: input.variantId });
        if (!match)
            throw new NotFoundError('Product variant not found');
        const { product, variant } = match;
        const { data: existing, error: existingErr } = await supabase
            .from('commerce_stock_batches')
            .select('*')
            .eq('shopify_variant_id', variant.id)
            .eq('batch_code', batchCode)
            .maybeSingle();
        throwIfSupabaseError(existingErr, 'Load existing batch');
        if (existing) {
            const { error } = await supabase
                .from('commerce_stock_batches')
                .update({
                qty: Number(existing.qty) + qty,
                mfg_date: input.mfgDate ?? existing.mfg_date,
                expiry_date: input.expiryDate ?? existing.expiry_date,
                updated_at: new Date().toISOString(),
            })
                .eq('id', existing.id);
            throwIfSupabaseError(error, 'Update commerce batch');
        }
        else {
            const { error } = await supabase.from('commerce_stock_batches').insert({
                shopify_product_id: product.id,
                shopify_variant_id: variant.id,
                batch_code: batchCode,
                mfg_date: input.mfgDate ?? null,
                expiry_date: input.expiryDate ?? null,
                qty,
                created_by: input.actorEmail ?? null,
            });
            throwIfSupabaseError(error, 'Create commerce batch');
        }
        const totalBalance = await shopifyInventoryService.adjustVariantStock(Number(variant.id), qty);
        shopifyProductsService.invalidateCatalogCache();
        return {
            productId: product.id,
            variantId: variant.id,
            batchCode,
            addedQty: qty,
            totalBalance,
        };
    },
};
//# sourceMappingURL=inventory-admin.service.js.map