import type { VisionObservation } from '../../domain/maios-reasoning/vision-observation.types.js';
export type VisitAnalyzePhotoInput = {
    dataBase64: string;
    mimeType?: string;
    photoType?: string;
};
export type VisitImageSignal = {
    label: string;
    confidence: number;
    source: 'plant_id' | 'vision' | 'fusion';
    photoCount: number;
    observations?: VisionObservation[];
};
export type VisitImageContext = {
    cropType?: string;
    dap?: number | null;
    stage?: string | null;
};
/** Run issue + visit photos through Plant.id or vision; fuse when multiple (up to 8). */
export declare function resolveVisitImagePredictions(photos: VisitAnalyzePhotoInput[] | undefined, ctx?: VisitImageContext): Promise<VisitImageSignal | null>;
//# sourceMappingURL=visit-ai-image.service.d.ts.map