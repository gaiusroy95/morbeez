import type { PlantIdHealthResult } from './types.js';
export type DiagnosisImageInput = {
    imageBase64: string;
    imageMimeType: string;
    imageStoragePath?: string;
};
export type PerImageDiagnosisSignal = {
    index: number;
    label: string;
    confidence: number;
    observations: string[];
    source: 'plant_id' | 'vision' | 'both';
    plantIdResult?: PlantIdHealthResult | null;
};
export type MultiImageFusionResult = {
    perImage: PerImageDiagnosisSignal[];
    fusedLabel: string;
    fusedConfidence: number;
    /** Prompt block for the final Crop Doctor synthesis call. */
    evidenceBlock: string;
    /** Best Plant.id result across photos (highest top disease probability). */
    primaryPlantIdResult: PlantIdHealthResult | null;
    plantIdSummary: string | undefined;
    analyzedCount: number;
    totalCount: number;
};
export type MultiImageAnalysisContext = {
    cropType?: string;
    cropStage?: string;
    dap?: number | null;
};
/** Pure fusion of per-image labels — exported for unit tests. */
export declare function fusePerImageSignals(signals: PerImageDiagnosisSignal[], totalCount: number): Pick<MultiImageFusionResult, 'fusedLabel' | 'fusedConfidence' | 'evidenceBlock' | 'analyzedCount' | 'totalCount'>;
/**
 * Analyze each diagnosis photo individually (Plant.id + focused vision),
 * then fuse labels into one evidence block for the final Crop Doctor call.
 */
export declare function analyzeAndFuseDiagnosisImages(images: DiagnosisImageInput[], ctx?: MultiImageAnalysisContext): Promise<MultiImageFusionResult | null>;
/** Collect unique base64 images from DiagnoseInput-shaped fields. */
export declare function collectDiagnosisImages(input: {
    imageBase64?: string;
    imageMimeType?: string;
    imageStoragePath?: string;
    diagnosisImages?: Array<{
        imageBase64?: string;
        imageMimeType: string;
        imageStoragePath?: string;
    }>;
}): DiagnosisImageInput[];
//# sourceMappingURL=multi-image-diagnosis.service.d.ts.map