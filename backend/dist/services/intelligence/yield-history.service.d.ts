export type YieldHistoryRow = {
    id: string;
    cropType: string;
    seasonLabel: string | null;
    yieldKgPerAcre: number | null;
    harvestDate: string | null;
    source: string;
};
export declare const yieldHistoryService: {
    syncFromHarvestRecords(farmerId: string, blockId?: string | null): Promise<void>;
    listForBlock(farmerId: string, blockId: string, limit?: number): Promise<YieldHistoryRow[]>;
};
//# sourceMappingURL=yield-history.service.d.ts.map