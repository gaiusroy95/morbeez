import type { GingerCanopyAudit, GingerFieldMetrics, GingerInputHistorySummary, GingerWaterReading } from '../../domain/ginger-sop/types.js';
export declare const gingerSopFieldDataService: {
    loadLatestMeasurements(farmerId: string, blockId?: string | null): Promise<{
        findingId: string | null;
        measurements: Map<string, number>;
    }>;
    buildFieldMetrics(measurements: Map<string, number>): GingerFieldMetrics | undefined;
    buildWaterReading(measurements: Map<string, number>, metadata?: {
        irrigationPh?: number;
        irrigationEc?: number;
    }): GingerWaterReading | undefined;
    buildCanopyAudit(measurements: Map<string, number>, dap?: number | null, canopyCoverPct?: number | null): GingerCanopyAudit | undefined;
    loadFieldContext(params: {
        farmerId: string;
        blockId?: string | null;
        dap?: number | null;
        metadata?: {
            irrigationPh?: number;
            irrigationEc?: number;
        };
    }): Promise<{
        findingId: string | null;
        fieldMetrics?: GingerFieldMetrics;
        canopyAudit?: GingerCanopyAudit;
        waterReading?: GingerWaterReading;
        inputHistory?: GingerInputHistorySummary;
        hasFieldMetrics: boolean;
        hasCanopyAudit: boolean;
        hasWaterData: boolean;
        hasInputHistory: boolean;
    }>;
};
//# sourceMappingURL=ginger-sop-field-data.service.d.ts.map