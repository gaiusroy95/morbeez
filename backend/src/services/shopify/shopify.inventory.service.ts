import { env } from '../../config/env.js';
import { ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { shopifyAdmin } from './shopify.client.js';

interface ShopifyLocation {
  id: number;
  active: boolean;
  name?: string;
}

interface VariantInventoryRow {
  id: number;
  inventory_item_id: number;
  inventory_management: string | null;
}

let cachedLocationId: number | null = null;

function configuredLocationId(): number | null {
  const raw = env.SHOPIFY_LOCATION_ID?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function getPrimaryLocationId(): Promise<number> {
  const configured = configuredLocationId();
  if (configured) return configured;
  if (cachedLocationId) return cachedLocationId;

  const res = await shopifyAdmin<{ locations: ShopifyLocation[] }>('/locations.json');
  const loc = res.locations?.find((l) => l.active) ?? res.locations?.[0];
  if (!loc?.id) throw new ValidationError('No active Shopify inventory location found');
  cachedLocationId = loc.id;
  return loc.id;
}

async function ensureVariantTracksInventory(variantId: number): Promise<number> {
  const res = await shopifyAdmin<{ variant: VariantInventoryRow }>(`/variants/${variantId}.json`);
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
    const refreshed = await shopifyAdmin<{ variant: VariantInventoryRow }>(`/variants/${variantId}.json`);
    itemId = refreshed.variant.inventory_item_id;
  }

  if (!itemId) throw new ValidationError(`Variant ${variantId} has no inventory item`);
  return itemId;
}

async function connectInventoryItem(inventoryItemId: number, locationId: number): Promise<void> {
  try {
    await shopifyAdmin('/inventory_levels/connect.json', {
      method: 'POST',
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryItemId,
      }),
    });
  } catch (err) {
    logger.debug({ err, inventoryItemId, locationId }, 'Inventory connect skipped (may already exist)');
  }
}

async function setAvailable(inventoryItemId: number, available: number): Promise<void> {
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

async function getAvailable(inventoryItemId: number): Promise<number> {
  const locationId = await getPrimaryLocationId();
  await connectInventoryItem(inventoryItemId, locationId);
  const res = await shopifyAdmin<{
    inventory_levels: Array<{ available: number }>;
  }>(
    `/inventory_levels.json?inventory_item_ids=${inventoryItemId}&location_ids=${locationId}`
  );
  return res.inventory_levels?.[0]?.available ?? 0;
}

export const shopifyInventoryService = {
  async getVariantStock(variantId: number): Promise<number> {
    const itemId = await ensureVariantTracksInventory(variantId);
    return getAvailable(itemId);
  },

  async adjustVariantStock(variantId: number, adjustment: number): Promise<number> {
    const delta = Math.floor(adjustment);
    if (!delta) {
      return this.getVariantStock(variantId);
    }
    const itemId = await ensureVariantTracksInventory(variantId);
    const locationId = await getPrimaryLocationId();
    await connectInventoryItem(itemId, locationId);
    const res = await shopifyAdmin<{
      inventory_level: { available: number };
    }>('/inventory_levels/adjust.json', {
      method: 'POST',
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: itemId,
        available_adjustment: delta,
      }),
    });
    return res.inventory_level?.available ?? 0;
  },

  async setVariantStock(variantId: number, stock: number): Promise<void> {
    const itemId = await ensureVariantTracksInventory(variantId);
    await setAvailable(itemId, stock);
  },

  /**
   * Apply stock quantities after product wizard save.
   * Matches input rows to saved Shopify variants by variant id, then by index.
   */
  async syncWizardVariantStocks(
    inputVariants: Array<{ id?: string; stock: number }>,
    savedVariants: Array<{ id: number }>
  ): Promise<void> {
    if (!savedVariants.length) return;

    const byId = new Map<string, number>();
    for (const row of inputVariants) {
      if (row.id) byId.set(String(row.id), Math.max(0, Number(row.stock) || 0));
    }

    for (let i = 0; i < savedVariants.length; i++) {
      const sv = savedVariants[i];
      const stock =
        byId.get(String(sv.id)) ??
        (inputVariants[i] != null ? Math.max(0, Number(inputVariants[i].stock) || 0) : 0);

      try {
        await this.setVariantStock(sv.id, stock);
      } catch (err) {
        logger.error({ err, variantId: sv.id, stock }, 'Failed to sync variant stock to Shopify');
        throw err;
      }
    }
  },
};
