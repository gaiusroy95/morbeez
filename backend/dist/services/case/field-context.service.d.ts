import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { MaiosCanopyAudit, MaiosFieldMetrics, MaiosInputHistorySummary, MaiosWaterReading } from '../../domain/case/types.js';
export declare const fieldContextService: {
    loadLatestMeasurements(farmerId: string, blockId?: string | null): Promise<{
        findingId: string | null;
        measurements: Map<string, number>;
    }>;
    buildCanopyAudit(pack: CropPackConfig, measurements: Map<string, number>, dap?: number | null): MaiosCanopyAudit | undefined;
    loadFieldContext(params: {
        farmerId: string;
        blockId?: string | null;
        dap?: number | null;
        pack: CropPackConfig;
        metadata?: {
            irrigationPh?: number;
            irrigationEc?: number;
        };
    }): Promise<{
        findingId: string | null;
        fieldMetrics?: MaiosFieldMetrics;
        canopyAudit?: MaiosCanopyAudit;
        waterReading?: MaiosWaterReading;
        inputHistory?: MaiosInputHistorySummary;
        hasFieldMetrics: boolean;
        hasCanopyAudit: boolean;
        hasWaterData: boolean;
        hasInputHistory: boolean;
    }>;
};
//# sourceMappingURL=field-context.service.d.ts.map