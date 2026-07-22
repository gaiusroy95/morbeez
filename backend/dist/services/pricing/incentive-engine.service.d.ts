import { type RetailOrBulk } from './incentive-formulas.js';
export type IncentiveLineResult = {
    variantId?: number;
    sku?: string;
    title?: string;
    qty: number;
    listedPrice: number;
    sellingPrice: number;
    recommendedPrice: number;
    safePrice: number;
    hardFloorPrice: number;
    realizationPct: number;
    incentivePerUnit: number;
    incentiveTotal: number;
    grossProfitPerUnit: number;
    grossProfitTotal: number;
    warningLevel: 'none' | 'low_margin' | 'critical' | 'blocked';
    warningMessage: string | null;
    allowed: boolean;
};
export type IncentivePreviewResult = {
    lines: IncentiveLineResult[];
    retailOrBulk: RetailOrBulk;
    orderTotal: number;
    subtotalGrossProfit: number;
    avgRealizationPct: number;
    totalIncentive: number;
    baseIncentivePct: number;
    realizationMultiplier: number;
    monthlyAchievementPct: number;
    monthlyMtdSalesInr: number;
    bulkGrossMarginPct: number | null;
    performanceHint: 'excellent' | 'good' | 'warning' | 'critical';
    warnings: string[];
    needsOwnerReview: boolean;
    hardFloorBlocked: boolean;
};
export declare const incentiveEngineService: {
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
    validateBulkMargin(preview: IncentivePreviewResult, opts?: {
        approved?: boolean;
        requestReview?: boolean;
    }): void;
};
//# sourceMappingURL=incentive-engine.service.d.ts.map