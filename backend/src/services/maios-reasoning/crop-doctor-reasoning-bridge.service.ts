import type { MaiosCase } from '../../domain/case/types.js';
import type { VisionObservation } from '../../domain/maios-reasoning/vision-observation.types.js';
import type { PlantIdHealthResult, StructuredAdvisory } from '../ai/types.js';
import { plantIdVisionFeaturesService } from './plant-id-vision-features.service.js';
import { diagnosisPresentationService } from './diagnosis-presentation.service.js';

/** Build structured vision features for v17 evidence from WhatsApp advisory + Plant.id. */
export function buildWhatsAppVisionObservations(params: {
  advisory: StructuredAdvisory;
  plantIdResult?: PlantIdHealthResult | null;
  cropType?: string | null;
}): VisionObservation[] {
  return plantIdVisionFeaturesService.resolve({
    cropType: params.cropType,
    plantIdResult: params.plantIdResult,
    observationLines: params.advisory.imageObservations,
    label: params.advisory.probableIssue,
    confidence: params.advisory.confidence,
  });
}

/**
 * When shadow mode is off, Bayesian posterior + presentation layer own probableIssue.
 * LLM advisory text (summaries, treatments) is preserved; labels are harmonized with treatments.
 */
export function applyBayesianDiagnosisToAdvisory(
  advisory: StructuredAdvisory,
  maiosCase: MaiosCase
): StructuredAdvisory {
  const reasoning = maiosCase.reasoning;
  if (!reasoning) return advisory;

  if (reasoning.shadowMode) {
    const presentation = diagnosisPresentationService.build({
      advisory,
      reasoning,
      shadowMode: true,
    });
    return diagnosisPresentationService.applyToAdvisory(advisory, presentation, reasoning);
  }

  const top =
    reasoning.decision.topLabel ??
    reasoning.explanation.diagnosis ??
    reasoning.posterior.find((p) => p.label !== 'Unknown')?.label;

  if (!top || top === 'Unknown') return advisory;

  const llmIssue = advisory.probableIssue;
  const supporting = reasoning.explanation.supporting;
  const bayesianNote = supporting.length
    ? `Bayesian evidence: ${supporting.slice(0, 3).join('; ')}`
    : null;

  let merged: StructuredAdvisory = {
    ...advisory,
    probableIssue: top,
    confidence:
      reasoning.explanation.confidence > 0
        ? reasoning.explanation.confidence
        : reasoning.decision.topConfidence,
    uncertain: reasoning.decision.action !== 'LOCK',
    differentialDiagnosis: reasoning.posterior
      .filter((p) => p.label !== 'Unknown')
      .slice(0, 5)
      .map((p) => ({
        label: p.label,
        reason:
          p.label === top
            ? 'Leading Bayesian posterior'
            : 'Alternative supported by evidence',
        probability: Math.round(p.probability * 1000) / 1000,
      })),
    rejectedHypotheses: [
      ...(advisory.rejectedHypotheses ?? []),
      ...(llmIssue && llmIssue.toLowerCase() !== top.toLowerCase()
        ? [`LLM-ranked issue demoted: ${llmIssue}`]
        : []),
      ...reasoning.explanation.rejected,
    ],
    explanation: [advisory.explanation, bayesianNote].filter(Boolean).join('\n\n') || advisory.explanation,
  };

  const presentation = diagnosisPresentationService.build({
    advisory: merged,
    reasoning,
    shadowMode: false,
  });

  merged = diagnosisPresentationService.applyToAdvisory(merged, presentation, reasoning);
  return merged;
}

/** Bridge — vision observations in, Bayesian diagnosis overlay out. */
export const cropDoctorReasoningBridgeService = {
  buildVisionObservations: buildWhatsAppVisionObservations,
  applyBayesianDiagnosis: applyBayesianDiagnosisToAdvisory,
};
