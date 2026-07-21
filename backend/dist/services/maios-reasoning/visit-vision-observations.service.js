import { plantIdVisionFeaturesService } from './plant-id-vision-features.service.js';
/** Domain 2 — structured image observations for Bayesian evidence (not LLM diagnosis ranking). */
export const visitVisionObservationsService = {
    inferFromLabel(label, baseConfidence, cropType) {
        return plantIdVisionFeaturesService.inferFromLabel(label, baseConfidence, cropType);
    },
    parseStructuredResponse(raw) {
        return plantIdVisionFeaturesService.resolve({ structured: raw });
    },
    merge(...groups) {
        return plantIdVisionFeaturesService.merge(...groups);
    },
    resolve(params) {
        return plantIdVisionFeaturesService.resolve({
            label: params.label,
            confidence: params.confidence,
            structured: params.structured,
            cropType: params.cropType,
        });
    },
};
//# sourceMappingURL=visit-vision-observations.service.js.map