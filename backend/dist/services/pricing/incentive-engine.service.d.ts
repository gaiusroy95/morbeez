import { pricingConfigService } from './pricing-config.service.js';
import { type ProductPricingTiers } from './safe-price-engine.service.js';
export type IncentiveLineResult = {
    variantId?: number;
    sku?: string;
    title?: string;
    qty: number;
    listedPrice: number;
    sellingPrice: number;
    recommendedPrice: number;
    hardFloorPrice: number;
    realizationPct: number;
    incentivePerUnit: number;
    incentiveTotal: number;
    grossProfitPerUnit: number;
    grossProfitTotal: number;
    netProfitPerUnit: number;
    netProfitTotal: number;
    warningLevel: 'none' | 'low_margin' | 'critical' | 'blocked';
    warningMessage: string | null;
    allowed: boolean;
};
export type IncentivePreviewResult = {
    lines: IncentiveLineResult[];
    subtotalIncentive: number;
    subtotalGrossProfit: number;
    subtotalNetProfit: number;
    avgRealizationPct: number;
    bulkOrderBonus: number;
    totalIncentive: number;
    orderTotal: number;
    performanceHint: 'excellent' | 'good' | 'warning' | 'critical';
    warnings: string[];
};
export declare const incentiveEngineService: {
    computeLine(input: {
        tiers: ProductPricingTiers;
        sellingPrice: number;
        qty: number;
        incentiveFactor?: number;
        config: Awaited<ReturnType<typeof pricingConfigService.getConfig>>;
    }): IncentiveLineResult;
    computeBulkBonus(orderTotal: number, config: Awaited<ReturnType<typeof pricingConfigService.getConfig>>): number;
    previewQuote(input: {
        lines: Array<{
            variantId?: number;
            sku?: string;
            title?: string;
            qty: number;
            unitPrice: number;
            catalogListedPrice?: number;
        }>;
        orderType?: "standard" | "bulk" | "clearance" | "strategic" | "liquidation";
        adminUserId?: string;
    }): Promise<IncentivePreviewResult>;
    recordQuoteLedger(input: {
        quoteId: string;
        leadId?: string | null;
        adminUserId?: string | null;
        orderType?: string;
        salesSource?: string;
        preview: IncentivePreviewResult;
        lineItems: Array<{
            variantId?: number;
            sku?: string;
            title?: string;
            qty: number;
            unitPrice: number;
        }>;
    }): Promise<void>;
    validateHardFloors(preview: IncentivePreviewResult): void;
};
//# sourceMappingURL=incentive-engine.service.d.ts.map