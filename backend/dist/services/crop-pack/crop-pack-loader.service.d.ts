import type { CropPackConfig } from '../../domain/crop-pack/types.js';
declare function normalizeCropKey(cropType: string): string;
export declare const cropPackLoaderService: {
    normalizeCropKey: typeof normalizeCropKey;
    builtinPacks(): CropPackConfig[];
    load(cropType: string): Promise<CropPackConfig>;
    whatsappSlotOrder(pack: CropPackConfig): string[];
    nextMissingSlots(pack: CropPackConfig, captured: string[], limit?: number): import("../../domain/crop-pack/types.js").CropPhotoSlotDef[];
    moduleWeights(pack: CropPackConfig): Record<string, number>;
};
export {};
//# sourceMappingURL=crop-pack-loader.service.d.ts.map