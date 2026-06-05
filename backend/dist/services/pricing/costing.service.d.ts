export type LandedCostInput = {
    supplierCost: number;
    freightCost?: number;
    customsCost?: number;
    packagingCost?: number;
    miscCost?: number;
};
export declare function computeLandedUnitCost(input: LandedCostInput): number;
export declare const costingService: {
    computeLandedUnitCost: typeof computeLandedUnitCost;
    /** Weighted average: (oldQty×oldCost + newQty×newCost) / totalQty */
    computeWeightedAverageCost(oldQty: number, oldCost: number, newQty: number, newCost: number): number;
    updateWeightedAverageCost(inventoryItemId: string, incomingQty: number, landedUnitCost: number): Promise<{
        weightedAvgCost: number;
        costQtyOnHand: number;
    } | null>;
};
//# sourceMappingURL=costing.service.d.ts.map