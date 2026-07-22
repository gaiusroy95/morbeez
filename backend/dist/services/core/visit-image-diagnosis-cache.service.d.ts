import type { VisitImageSignal } from './visit-ai-image.service.js';
export declare function hashVisitImageBase64(dataBase64: string): string;
export declare function normalizeVisitImageCropType(cropType?: string | null): string;
export declare function lookupVisitImageDiagnosis(contentHash: string, cropType?: string | null): Promise<VisitImageSignal | null>;
export declare function storeVisitImageDiagnosis(contentHash: string, cropType: string | null | undefined, signal: Pick<VisitImageSignal, 'label' | 'confidence' | 'source'>): Promise<void>;
//# sourceMappingURL=visit-image-diagnosis-cache.service.d.ts.map