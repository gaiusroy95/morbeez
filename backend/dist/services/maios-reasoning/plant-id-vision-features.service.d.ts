import type { VisionObservation } from '../../domain/maios-reasoning/vision-observation.types.js';
import type { PlantIdHealthResult } from '../ai/types.js';
declare function normalizeCrop(cropType?: string | null): 'ginger' | 'tomato' | 'banana' | 'coconut' | 'brinjal' | 'generic';
/** Crop-aware structured feature extraction from vision labels and Plant.id disease names. */
export declare const plantIdVisionFeaturesService: {
    normalizeCrop: typeof normalizeCrop;
    inferFromLabel(label: string, baseConfidence: number, cropType?: string | null): VisionObservation[];
    inferFromObservationText(text: string, cropType?: string | null): VisionObservation[];
    inferFromPlantIdResult(result: PlantIdHealthResult | null | undefined, cropType?: string | null): VisionObservation[];
    visionPromptFeatureList(cropType?: string | null): string;
    merge(...groups: VisionObservation[][]): VisionObservation[];
    resolve(params: {
        cropType?: string | null;
        label?: string | null;
        confidence?: number;
        structured?: unknown;
        plantIdResult?: PlantIdHealthResult | null;
        observationLines?: string[];
    }): VisionObservation[];
};
export {};
//# sourceMappingURL=plant-id-vision-features.service.d.ts.map