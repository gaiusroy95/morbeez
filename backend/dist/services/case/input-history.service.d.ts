import type { MaiosInputHistorySummary } from '../../domain/case/types.js';
export declare const inputHistoryService: {
    daysSinceLastFertilizer(summary?: MaiosInputHistorySummary): number | null;
    load21Day(farmerId: string, blockId?: string | null): Promise<MaiosInputHistorySummary>;
};
//# sourceMappingURL=input-history.service.d.ts.map