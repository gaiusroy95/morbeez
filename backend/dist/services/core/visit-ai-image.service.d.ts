export type VisitAnalyzePhotoInput = {
    dataBase64: string;
    mimeType?: string;
};
export type VisitImageSignal = {
    label: string;
    confidence: number;
    source: 'plant_id' | 'vision' | 'fusion';
    photoCount: number;
};
/** Run issue + visit photos through Plant.id or vision; fuse when multiple (up to 8). */
export declare function resolveVisitImagePredictions(photos: VisitAnalyzePhotoInput[] | undefined): Promise<VisitImageSignal | null>;
//# sourceMappingURL=visit-ai-image.service.d.ts.map