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
export declare const safePriceEngineService: {
    calculateTiersWithConfig(input: {
        effectiveCost: number;
        listedPrice?: number;
    }, config: Awaited<ReturnType<typeof pricingConfigService.getConfig>>): {
        listedPrice: number;
        recommendedPrice: number;
        safePrice: number;
        hardFloorPrice: number;
        effectiveCost: number;
    };
    recalculateForItem(input: {
        inventoryItemId: string;
        sku?: string | null;
        shopifyVariantId?: string | null;
        effectiveCost: number;
        listedPrice?: number;
    }): Promise<{
        listedPrice: number;
        recommendedPrice: number;
        safePrice: number;
        hardFloorPrice: number;
        effectiveCost: number;
    }>;
    resolveByVariantOrSku(input: {
        variantId?: number | string | null;
        sku?: string | null;
        catalogListedPrice?: number;
    }): Promise<ProductPricingTiers>;
    /** Employee-safe view — no cost or margin */
    toEmployeeView(tiers: ProductPricingTiers): {
        listedPrice: number;
        recommendedPrice: number;
        recommendedMin: number;
        recommendedMax: number;
        hardFloorPrice: number;
        safePrice: number;
    };
};
//# sourceMappingURL=safe-price-engine.service.d.ts.map