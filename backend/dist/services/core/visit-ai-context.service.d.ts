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
    fieldVoiceNote?: string;
};
export type VisitContextSnapshot = {
    measurements: Array<{
        key: string;
        value: string;
        unit?: string;
    }>;
    blockAssessment?: BuildContextInput['blockAssessment'];
    soilTestSummary: VisitAiContextPack['soilTestSummary'];
    weatherSnapshot: VisitAiContextPack['weatherSnapshot'];
    imageSignal?: {
        label: string;
        confidence: number;
        source?: string;
        photoCount?: number;
    } | null;
    fieldVoiceNote?: string | null;
    analyzePhotoCount?: number;
    capturedAt: string;
};
declare function snapshotFromPack(pack: VisitAiContextPack, extras?: {
    imageSignal?: VisitContextSnapshot['imageSignal'];
    fieldVoiceNote?: string | null;
    analyzePhotoCount?: number;
}): VisitContextSnapshot;
export declare const visitAiContextService: {
    snapshotFromPack: typeof snapshotFromPack;
    mergeSnapshotIntoInput(input: BuildContextInput, snapshot: VisitContextSnapshot | null | undefined): BuildContextInput;
    applySnapshotToPack(pack: VisitAiContextPack, snapshot: VisitContextSnapshot | null | undefined): VisitAiContextPack;
    snapshotFromCaseMetadata(metadata: Record<string, unknown>): VisitContextSnapshot | null;
    buildVisitAiContext(input: BuildContextInput): Promise<VisitAiContextPack>;
    buildContextForCase(caseRow: {
        farmer_id: string;
        block_id: string;
        session_id?: string | null;
        metadata?: Record<string, unknown> | null;
    }): Promise<VisitAiContextPack>;
};
export {};
//# sourceMappingURL=visit-ai-context.service.d.ts.map