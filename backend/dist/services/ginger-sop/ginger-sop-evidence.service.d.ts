import type { GingerPhotoEvidence, GingerPhotoSlotId, GingerSopChannel } from '../../domain/ginger-sop/types.js';
export declare const gingerSopEvidenceService: {
    assignPhotosToSlots(params: {
        photoCount: number;
        channel: GingerSopChannel;
        storagePaths?: string[];
        captions?: string[];
        existingSlots?: GingerPhotoSlotId[];
    }): GingerPhotoEvidence[];
    completenessPct(photos: GingerPhotoEvidence[]): number;
    evidenceTier(completenessPct: number, hasSoil: boolean, hasRootPhoto: boolean, hasFieldMetrics: boolean): "T0" | "T1" | "T2" | "T3" | "T4" | "T5";
    missingSlotPrompt(language: string, slots: GingerPhotoSlotId[]): string;
};
//# sourceMappingURL=ginger-sop-evidence.service.d.ts.map