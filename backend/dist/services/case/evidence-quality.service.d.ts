import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { EvidenceTier, MaiosChannel, MaiosPhotoEvidence } from '../../domain/case/types.js';
export declare const evidenceQualityService: {
    assignPhotosToSlots(params: {
        pack: CropPackConfig;
        photoCount: number;
        channel: MaiosChannel;
        storagePaths?: string[];
        captions?: string[];
        existingSlots?: string[];
    }): MaiosPhotoEvidence[];
    completenessPct(photos: MaiosPhotoEvidence[], slotCount: number): number;
    evidenceTier(completenessPct: number, hasSoil: boolean, hasRootPhoto: boolean, hasFieldMetrics: boolean): EvidenceTier;
    /** Unified EQS 0–100 from completeness + tier bonuses */
    computeEqs(params: {
        completenessPct: number;
        tier: EvidenceTier;
        hasSoil: boolean;
        hasRootPhoto: boolean;
        hasFieldMetrics: boolean;
        hasWaterData: boolean;
        hasLabReport: boolean;
    }): number;
    missingSlotPrompt(pack: CropPackConfig, language: string, slots: string[]): string;
};
//# sourceMappingURL=evidence-quality.service.d.ts.map