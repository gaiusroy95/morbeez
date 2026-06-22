import { supabase } from '../../lib/supabase.js';
/** Auto-queue when recommendation_count >= threshold for same technical + crop + district */
const GAP_THRESHOLD = 5;
async function findGapRow(technicalName, cropType, district) {
    const { data } = await supabase
        .from('product_gap_queue')
        .select('*')
        .eq('technical_name', technicalName)
        .eq('crop_type', cropType ?? '')
        .eq('district', district ?? '')
        .maybeSingle();
    return data;
}
export const productGapService = {
    async incrementFromRecommendation(params) {
        const name = params.technicalName.trim();
        if (!name.length)
            return;
        const crop = params.cropType?.toLowerCase().trim() ?? '';
        const district = params.district?.trim() ?? '';
        const existing = await findGapRow(name, crop || undefined, district || undefined);
        const samples = Array.isArray(existing?.sample_recommendation_ids)
            ? [...existing.sample_recommendation_ids]
            : [];
        if (params.recommendationRecordId && samples.length < 15 && !samples.includes(params.recommendationRecordId)) {
            samples.push(params.recommendationRecordId);
        }
        const count = (existing?.recommendation_count ?? 0) + 1;
        const urgency = count >= 25 ? 'critical' : count >= 15 ? 'high' : count >= GAP_THRESHOLD ? 'normal' : 'low';
        if (existing) {
            await supabase
                .from('product_gap_queue')
                .update({
                recommendation_count: count,
                crop_subtype: params.cropSubtype ?? existing.crop_subtype ?? null,
                sample_recommendation_ids: samples,
                urgency,
                status: count >= GAP_THRESHOLD ? 'open' : existing.status,
                updated_at: new Date().toISOString(),
            })
                .eq('id', existing.id);
            return;
        }
        await supabase.from('product_gap_queue').insert({
            technical_name: name,
            crop_type: crop || null,
            crop_subtype: params.cropSubtype ?? null,
            district: district || null,
            recommendation_count: count,
            urgency,
            status: count >= GAP_THRESHOLD ? 'open' : 'open',
            sample_recommendation_ids: samples,
        });
    },
    async listOpen(limit = 50) {
        const { data, error } = await supabase
            .from('product_gap_queue')
            .select('*')
            .in('status', ['open', 'reviewing'])
            .gte('recommendation_count', GAP_THRESHOLD)
            .order('recommendation_count', { ascending: false })
            .limit(limit);
        if (error)
            throw error;
        return data ?? [];
    },
    async updateStatus(id, status) {
        const { data, error } = await supabase
            .from('product_gap_queue')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single();
        if (error)
            throw error;
        return data;
    },
    /** Read-only commerce inventory + rough ETA for gap sourcing (Shopify + WMS). */
    async getCommerceInventoryEta(technicalName) {
        const name = technicalName.trim();
        if (!name.length)
            return null;
        const { data: wmsRows } = await supabase
            .from('inventory_items')
            .select('id, product_title, sku')
            .or(`product_title.ilike.%${name}%,sku.ilike.%${name}%`)
            .eq('active', true)
            .limit(5);
        let availableQty = 0;
        let matchedTitle = null;
        if (wmsRows?.length) {
            const itemIds = wmsRows.map((r) => String(r.id));
            const { data: batches } = await supabase
                .from('inventory_batches')
                .select('inventory_item_id, qty_available')
                .in('inventory_item_id', itemIds)
                .eq('status', 'available');
            for (const batch of batches ?? []) {
                availableQty += Number(batch.qty_available ?? 0);
            }
            matchedTitle = String(wmsRows[0].product_title ?? wmsRows[0].sku ?? name);
        }
        if (!availableQty) {
            try {
                const { shopifyProductsService } = await import('../shopify/shopify.products.service.js');
                const catalog = await shopifyProductsService.list({ search: name, limit: 8, status: 'active' });
                for (const product of catalog.products) {
                    const haystack = `${product.title} ${product.sku ?? ''}`.toLowerCase();
                    if (!haystack.includes(name.toLowerCase()))
                        continue;
                    const stock = product.inventory ?? 0;
                    if (stock > availableQty) {
                        availableQty = stock;
                        matchedTitle = product.title;
                    }
                }
            }
            catch {
                /* commerce lookup optional */
            }
        }
        let etaDays = null;
        if (availableQty <= 0 && wmsRows?.length) {
            const itemIds = wmsRows.map((r) => String(r.id));
            const { data: poLines } = await supabase
                .from('purchase_order_lines')
                .select('qty_ordered, qty_received, purchase_orders!inner(status, expected_delivery_date)')
                .in('inventory_item_id', itemIds)
                .limit(10);
            for (const line of poLines ?? []) {
                const po = line.purchase_orders;
                if (!po || po.status === 'cancelled')
                    continue;
                const remaining = Number(line.qty_ordered ?? 0) - Number(line.qty_received ?? 0);
                if (remaining <= 0)
                    continue;
                if (po.expected_delivery_date) {
                    const days = Math.ceil((new Date(po.expected_delivery_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                    etaDays = etaDays == null ? Math.max(0, days) : Math.min(etaDays, Math.max(0, days));
                }
                else if (etaDays == null) {
                    etaDays = 14;
                }
            }
        }
        return {
            technicalName: name,
            availableQty,
            etaDays: availableQty > 0 ? 0 : etaDays,
            source: wmsRows?.length ? (availableQty ? 'wms' : 'commerce') : availableQty ? 'commerce' : 'none',
            matchedTitle,
        };
    },
    /** Suggest substitute technicals from rotation rules + commerce catalog. */
    async listAlternatives(technicalName, cropType) {
        const name = technicalName.trim().toLowerCase();
        if (!name.length)
            return [];
        const { data: rotation } = await supabase
            .from('resistance_rotation_rules')
            .select('crop_type, active_ingredient, alternate_ingredients')
            .limit(50);
        const alts = [];
        for (const row of rotation ?? []) {
            const active = String(row.active_ingredient ?? '').toLowerCase();
            if (!active.includes(name) && !name.includes(active))
                continue;
            if (cropType && row.crop_type && String(row.crop_type).toLowerCase() !== cropType.toLowerCase())
                continue;
            const alternates = Array.isArray(row.alternate_ingredients) ? row.alternate_ingredients : [];
            for (const alt of alternates) {
                const tn = String(alt).trim();
                if (tn.length)
                    alts.push({ technicalName: tn, reason: 'Resistance rotation rule' });
            }
        }
        if (alts.length < 3) {
            try {
                const { shopifyProductsService } = await import('../shopify/shopify.products.service.js');
                const catalog = await shopifyProductsService.list({ search: name.split(' ')[0], limit: 6, status: 'active' });
                for (const p of catalog.products) {
                    if (p.title.toLowerCase().includes(name))
                        continue;
                    alts.push({ technicalName: p.title, reason: 'Commerce catalog match' });
                }
            }
            catch {
                /* optional */
            }
        }
        const seen = new Set();
        const out = [];
        for (const a of alts) {
            const key = a.technicalName.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            const eta = await this.getCommerceInventoryEta(a.technicalName).catch(() => null);
            out.push({ ...a, availableQty: eta?.availableQty });
            if (out.length >= 8)
                break;
        }
        return out;
    },
};
//# sourceMappingURL=product-gap.service.js.map