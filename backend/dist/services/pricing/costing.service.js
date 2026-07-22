import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { safePriceEngineService } from './safe-price-engine.service.js';
export function computeLandedUnitCost(input) {
    const supplier = Number(input.supplierCost) || 0;
    const freight = Number(input.freightCost) || 0;
    const customs = Number(input.customsCost) || 0;
    const packaging = Number(input.packagingCost) || 0;
    const misc = Number(input.miscCost) || 0;
    return Math.round((supplier + freight + customs + packaging + misc) * 100) / 100;
}
export const costingService = {
    computeLandedUnitCost,
    /** Weighted average: (oldQty×oldCost + newQty×newCost) / totalQty */
    computeWeightedAverageCost(oldQty, oldCost, newQty, newCost) {
        const totalQty = oldQty + newQty;
        if (totalQty <= 0)
            return newCost;
        if (oldQty <= 0)
            return newCost;
        const avg = (oldQty * oldCost + newQty * newCost) / totalQty;
        return Math.round(avg * 100) / 100;
    },
    async updateWeightedAverageCost(inventoryItemId, incomingQty, landedUnitCost) {
        const { data: item, error } = await supabase
            .from('inventory_items')
            .select('weighted_avg_cost, cost_qty_on_hand, sku, shopify_variant_id')
            .eq('id', inventoryItemId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Load inventory item for costing');
        if (!item)
            return null;
        const oldQty = Number(item.cost_qty_on_hand) || 0;
        const oldCost = Number(item.weighted_avg_cost) || 0;
        const newAvg = this.computeWeightedAverageCost(oldQty, oldCost, incomingQty, landedUnitCost);
        const newQty = oldQty + incomingQty;
        const { error: updErr } = await supabase
            .from('inventory_items')
            .update({
            weighted_avg_cost: newAvg,
            cost_qty_on_hand: newQty,
            last_cost_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', inventoryItemId);
        throwIfSupabaseError(updErr, 'Update weighted average cost');
        await safePriceEngineService.recalculateForItem({
            inventoryItemId,
            sku: item.sku ? String(item.sku) : null,
            shopifyVariantId: item.shopify_variant_id ? String(item.shopify_variant_id) : null,
            effectiveCost: newAvg,
        });
        return { weightedAvgCost: newAvg, costQtyOnHand: newQty };
    },
};
//# sourceMappingURL=costing.service.js.map