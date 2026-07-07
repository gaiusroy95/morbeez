import type { VisionObservation } from '../../domain/maios-reasoning/vision-observation.types.js';
import { plantIdVisionFeaturesService } from './plant-id-vision-features.service.js';

/** Domain 2 — structured image observations for Bayesian evidence (not LLM diagnosis ranking). */
export const visitVisionObservationsService = {
  inferFromLabel(label: string, baseConfidence: number, cropType?: string | null): VisionObservation[] {
    return plantIdVisionFeaturesService.inferFromLabel(label, baseConfidence, cropType);
  },

  parseStructuredResponse(raw: unknown): VisionObservation[] {
    return plantIdVisionFeaturesService.resolve({ structured: raw });
  },

  merge(...groups: VisionObservation[][]): VisionObservation[] {
    return plantIdVisionFeaturesService.merge(...groups);
  },

  resolve(params: {
    label?: string | null;
    confidence?: number;
    structured?: unknown;
    cropType?: string | null;
  }): VisionObservation[] {
    return plantIdVisionFeaturesService.resolve({
      label: params.label,
      confidence: params.confidence,
      structured: params.structured,
      cropType: params.cropType,
    });
  },
};
