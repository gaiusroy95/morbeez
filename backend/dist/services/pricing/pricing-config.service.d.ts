export type PricingEngineConfig = {
    targetGrossMarginPct: number;
    recommendedPctOfListed: number;
    safeMarginPctOfGross: number;
    hardFloorMarginPctOfGross: number;
    incentiveFactor: number;
    platformCostPct: number;
    adAllocationPct: number;
    returnRiskPct: number;
    realizationExcellent: number;
    realizationGood: number;
    realizationWarning: number;
    bulkBonus25k: number;
    bulkBonus50k: number;
    bulkBonus100k: number;
};
export declare const pricingConfigService: {
    getConfig(): Promise<PricingEngineConfig>;
    updateConfig(patch: Partial<PricingEngineConfig>): Promise<{
        targetGrossMarginPct: number;
        recommendedPctOfListed: number;
        safeMarginPctOfGross: number;
        hardFloorMarginPctOfGross: number;
        incentiveFactor: number;
        platformCostPct: number;
        adAllocationPct: number;
        returnRiskPct: number;
        realizationExcellent: number;
        realizationGood: number;
        realizationWarning: number;
        bulkBonus25k: number;
        bulkBonus50k: number;
        bulkBonus100k: number;
    }>;
};
//# sourceMappingURL=pricing-config.service.d.ts.map