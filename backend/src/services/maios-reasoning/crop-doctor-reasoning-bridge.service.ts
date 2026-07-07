import type { MaiosCase } from '../../domain/case/types.js';
import type { VisionObservation } from '../../domain/maios-reasoning/vision-observation.types.js';
import type { PlantIdHealthResult, StructuredAdvisory } from '../ai/types.js';
import { plantIdVisionFeaturesService } from './plant-id-vision-features.service.js';
import { diagnosisPresentationService } from './diagnosis-presentation.service.js';

/** Build structured vision features from photo observations and Plant.id — not from diagnosis label. */
export function buildWhatsAppVisionObservations(params: {
  advisory: StructuredAdvisory;
  plantIdResult?: PlantIdHealthResult | null;
  cropType?: string | null;
}): VisionObservation[] {
  return plantIdVisionFeaturesService.resolve({
    cropType: params.cropType,
    plantIdResult: params.plantIdResult,
    observationLines: params.advisory.imageObservations,
  });
}

/**
 * Fuse LLM vision ranking with Bayesian posterior for farmer-facing labels.
 * Treatments and narrative text stay from the LLM; labels follow fused evidence.
 */
export function applyBayesianDiagnosisToAdvisory(
  advisory: StructuredAdvisory,
  maiosCase: MaiosCase
): StructuredAdvisory {
  const reasoning = maiosCase.reasoning;
  if (!reasoning) return advisory;

  const supporting = reasoning.explanation.supporting;
  const bayesianNote = supporting.length
    ? `Evidence summary: ${supporting.slice(0, 3).join('; ')}`
    : null;

  const presentation = diagnosisPresentationService.build({
    advisory: {
      ...advisory,
      explanation: [advisory.explanation, bayesianNote].filter(Boolean).join('\n\n') || advisory.explanation,
    },
    reasoning,
    shadowMode: reasoning.shadowMode,
  });

  return diagnosisPresentationService.applyToAdvisory(advisory, presentation, reasoning);
}

/** Bridge — vision observations in, Bayesian diagnosis overlay out. */
export const cropDoctorReasoningBridgeService = {
  buildVisionObservations: buildWhatsAppVisionObservations,
  applyBayesianDiagnosis: applyBayesianDiagnosisToAdvisory,
};
