export type CommissionCategoryKey = 'soil_testing' | 'water_testing' | 'monitoring_package' | 'advisory_package' | 'high_margin_specialty' | 'biologicals' | 'generic_fertilizers' | 'commodity_fertilizers' | 'commercial_order' | 'dealer_order' | 'fpo_order';
export declare function resolveCommissionCategory(input: {
    sku?: string | null;
    title?: string | null;
    productType?: string | null;
    orderKind?: string | null;
}): CommissionCategoryKey;
export declare function dominantCategory(lines: Array<{
    sku?: string | null;
    title?: string | null;
    productType?: string | null;
    salesInr: number;
}>): CommissionCategoryKey;
export declare function isCommercialOrder(grossInr: number): boolean;
export declare function reliabilityHoldPct(score: number): number;
//# sourceMappingURL=commission-category.d.ts.map