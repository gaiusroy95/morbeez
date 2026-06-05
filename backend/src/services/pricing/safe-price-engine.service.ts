import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { pricingConfigService } from './pricing-config.service.js';

export type ProductPricingTiers = {
  inventoryItemId: string | null;
  sku: string | null;
  variantId: string | null;
  listedPrice: number;
  recommendedPrice: number;
  safePrice: number;
  hardFloorPrice: number;
  effectiveCost: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const safePriceEngineService = {
  calculateTiersWithConfig(
    input: { effectiveCost: number; listedPrice?: number },
    config: Awaited<ReturnType<typeof pricingConfigService.getConfig>>
  ) {
    const cost = Math.max(0, Number(input.effectiveCost) || 0);
    const marginPct = config.targetGrossMarginPct / 100;
    const calculatedListed = cost > 0 ? cost / (1 - marginPct) : 0;
    const listed = round2(
      input.listedPrice && input.listedPrice > 0
        ? Math.max(input.listedPrice, calculatedListed || input.listedPrice)
        : calculatedListed
    );
    const grossProfit = Math.max(0, listed - cost);
    const recommended = round2(listed * (config.recommendedPctOfListed / 100));
    const safe = round2(cost + grossProfit * (config.safeMarginPctOfGross / 100));
    const hardFloor = round2(cost + grossProfit * (config.hardFloorMarginPctOfGross / 100));

    return {
      listedPrice: listed,
      recommendedPrice: recommended,
      safePrice: safe,
      hardFloorPrice: hardFloor,
      effectiveCost: cost,
    };
  },

  async recalculateForItem(input: {
    inventoryItemId: string;
    sku?: string | null;
    shopifyVariantId?: string | null;
    effectiveCost: number;
    listedPrice?: number;
  }) {
    const config = await pricingConfigService.getConfig();
    const tiers = this.calculateTiersWithConfig(
      { effectiveCost: input.effectiveCost, listedPrice: input.listedPrice },
      config
    );

    const row = {
      inventory_item_id: input.inventoryItemId,
      shopify_variant_id: input.shopifyVariantId ?? null,
      sku: input.sku ?? null,
      listed_price: tiers.listedPrice,
      recommended_price: tiers.recommendedPrice,
      safe_price: tiers.safePrice,
      hard_floor_price: tiers.hardFloorPrice,
      effective_cost: tiers.effectiveCost,
      recalculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('product_pricing_tiers').upsert(row, {
      onConflict: 'inventory_item_id',
    });
    throwIfSupabaseError(error, 'Upsert product pricing tiers');
    return tiers;
  },

  async resolveByVariantOrSku(input: {
    variantId?: number | string | null;
    sku?: string | null;
    catalogListedPrice?: number;
  }): Promise<ProductPricingTiers> {
    const config = await pricingConfigService.getConfig();
    const variantKey = input.variantId != null ? String(input.variantId) : null;
    const sku = input.sku?.trim() || null;

    let tierRow: Record<string, unknown> | null = null;
    if (variantKey) {
      const { data } = await supabase
        .from('product_pricing_tiers')
        .select('*')
        .eq('shopify_variant_id', variantKey)
        .maybeSingle();
      tierRow = data;
    }
    if (!tierRow && sku) {
      const { data } = await supabase.from('product_pricing_tiers').select('*').eq('sku', sku).maybeSingle();
      tierRow = data;
    }

    if (tierRow) {
      return {
        inventoryItemId: tierRow.inventory_item_id ? String(tierRow.inventory_item_id) : null,
        sku: tierRow.sku ? String(tierRow.sku) : sku,
        variantId: tierRow.shopify_variant_id ? String(tierRow.shopify_variant_id) : variantKey,
        listedPrice: Number(tierRow.listed_price) || 0,
        recommendedPrice: Number(tierRow.recommended_price) || 0,
        safePrice: Number(tierRow.safe_price) || 0,
        hardFloorPrice: Number(tierRow.hard_floor_price) || 0,
        effectiveCost: Number(tierRow.effective_cost) || 0,
      };
    }

    // Fallback: derive tiers from Shopify listed price assuming target margin
    const listed = Number(input.catalogListedPrice) || 0;
    const impliedCost = listed > 0 ? listed * (1 - config.targetGrossMarginPct / 100) : 0;
    const tiers = this.calculateTiersWithConfig(
      { effectiveCost: impliedCost, listedPrice: listed },
      config
    );

    return {
      inventoryItemId: null,
      sku,
      variantId: variantKey,
      ...tiers,
    };
  },

  /** Employee-safe view — no cost or margin */
  toEmployeeView(tiers: ProductPricingTiers) {
    return {
      listedPrice: tiers.listedPrice,
      recommendedPrice: tiers.recommendedPrice,
      recommendedMin: tiers.recommendedPrice,
      recommendedMax: tiers.listedPrice,
      hardFloorPrice: tiers.hardFloorPrice,
    };
  },
};
