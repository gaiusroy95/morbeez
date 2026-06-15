import type { BlockHealthLevel, CropPerformanceLevel, SoilMoistureLevel } from '../../domain/ai-training/enums.js';
export type VisitAiContextPack = {
    farmerId: string;
    blockId: string;
    sessionId?: string;
    cropType: string;
    dap: number | null;
    stage: string | null;
    blockAssessment?: {
        blockHealth: BlockHealthLevel;
        cropPerformance: CropPerformanceLevel;
        soilMoisture: SoilMoistureLevel;
    };
    measurements: Array<{
        key: string;
        value: string;
        unit?: string;
    }>;
    soilTestSummary: Record<string, unknown> | null;
    weatherSnapshot: Record<string, unknown> | null;
    gps: {
        latitude: number;
        longitude: number;
    } | null;
};
type BuildContextInput = {
    farmerId: string;
    blockId: string;
    sessionId?: string;
    blockAssessment?: {
        blockHealth: BlockHealthLevel;
        cropPerformance: CropPerformanceLevel;
        soilMoisture: SoilMoistureLevel;
    };
    measurements?: Array<{
        key: string;
        value: string;
        unit?: string;
    }>;
    latitude?: number;
    longitude?: number;
};
export declare const visitAiContextService: {
    buildVisitAiContext(input: BuildContextInput): Promise<VisitAiContextPack>;
};
export {};
//# sourceMappingURL=visit-ai-context.service.d.ts.map