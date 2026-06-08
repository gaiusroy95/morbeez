import { env } from '../../config/env.js';
import { ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { shopifyAdmin } from './shopify.client.js';
let cachedLocationId = null;
function configuredLocationId() {
    const raw = env.SHOPIFY_LOCATION_ID?.trim();
    if (!raw)
        return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
}
async function getPrimaryLocationId() {
    const configured = configuredLocationId();
    if (configured)
        return configured;
    if (cachedLocationId)
        return cachedLocationId;
    const res = await shopifyAdmin('/locations.json');
    const loc = res.locations?.find((l) => l.active) ?? res.locations?.[0];
    if (!loc?.id)
        throw new ValidationError('No active Shopify inventory location found');
    cachedLocationId = loc.id;
    return loc.id;
}
async function ensureVariantTracksInventory(variantId) {
    const res = await shopifyAdmin(`/variants/${variantId}.json`);
    let itemId = res.variant.inventory_item_id;
    if (res.variant.inventory_management !== 'shopify') {
        await shopifyAdmin(`/variants/${variantId}.json`, {
            method: 'PUT',
            body: JSON.stringify({
                variant: {
                    id: variantId,
                    inventory_management: 'shopify',
                    inventory_policy: 'deny',
                },
            }),
        });
        const refreshed = await shopifyAdmin(`/variants/${variantId}.json`);
        itemId = refreshed.variant.inventory_item_id;
    }
    if (!itemId)
        throw new ValidationError(`Variant ${variantId} has no inventory item`);
    return itemId;
}
async function connectInventoryItem(inventoryItemId, locationId) {
    try {
        await shopifyAdmin('/inventory_levels/connect.json', {
            method: 'POST',
            body: JSON.stringify({
                location_id: locationId,
                inventory_item_id: inventoryItemId,
            }),
        });
    }
    catch (err) {
        logger.debug({ err, inventoryItemId, locationId }, 'Inventory connect skipped (may already exist)');
    }
}
async function setAvailable(inventoryItemId, available) {
    const locationId = await getPrimaryLocationId();
    await connectInventoryItem(inventoryItemId, locationId);
    await shopifyAdmin('/inventory_levels/set.json', {
        method: 'POST',
        body: JSON.stringify({
            location_id: locationId,
            inventory_item_id: inventoryItemId,
            available: Math.max(0, Math.floor(available)),
        }),
    });
}
export const shopifyInventoryService = {
    async setVariantStock(variantId, stock) {
        const itemId = await ensureVariantTracksInventory(variantId);
        await setAvailable(itemId, stock);
    },
    /**
     * Apply stock quantities after product wizard save.
     * Matches input rows to saved Shopify variants by variant id, then by index.
     */
    async syncWizardVariantStocks(inputVariants, savedVariants) {
        if (!savedVariants.length)
            return;
        const byId = new Map();
        for (const row of inputVariants) {
            if (row.id)
                byId.set(String(row.id), Math.max(0, Number(row.stock) || 0));
        }
        for (let i = 0; i < savedVariants.length; i++) {
            const sv = savedVariants[i];
            const stock = byId.get(String(sv.id)) ??
                (inputVariants[i] != null ? Math.max(0, Number(inputVariants[i].stock) || 0) : 0);
            try {
                await this.setVariantStock(sv.id, stock);
            }
            catch (err) {
                logger.error({ err, variantId: sv.id, stock }, 'Failed to sync variant stock to Shopify');
                throw err;
            }
        }
    },
};
//# sourceMappingURL=shopify.inventory.service.js.map