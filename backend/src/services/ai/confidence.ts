/**
 * Merges GPT + Plant.id signals and delegates routing to the AI training domain.
 * @see backend/src/domain/ai-training/confidence-routing.ts
 */
import type { PlantIdHealthResult, StructuredAdvisory } from './types.js';
import {
  shouldEscalate as domainShouldEscalate,
  shouldAutoSend,
  escalationReason as domainEscalationReason,
  resolveConfidenceAction,
  getEscalationThreshold,
} from '../../domain/ai-training/confidence-routing.js';

export { getEscalationThreshold, resolveConfidenceAction, shouldAutoSend };

/** Merge Plant.id signal with GPT self-reported confidence */
export function computeConfidence(
  gptConfidence: number,
  plantId?: PlantIdHealthResult | null
): number {
  let plantSignal = 0.5;
  if (plantId?.diseases?.length) {
    plantSignal = Math.max(...plantId.diseases.map((d) => d.probability));
  } else if (plantId?.isHealthy === true) {
    plantSignal = 0.75;
  }

  const hasPlantDisease = Boolean(plantId?.diseases?.length);
  const merged = hasPlantDisease
    ? gptConfidence * 0.6 + plantSignal * 0.4
    : gptConfidence * 0.92 + plantSignal * 0.08;
  return Math.round(Math.min(1, Math.max(0, merged)) * 10000) / 10000;
}

export function shouldEscalate(confidence: number, advisory: StructuredAdvisory): boolean {
  return domainShouldEscalate(confidence, advisory);
}

export function escalationReason(confidence: number, advisory: StructuredAdvisory): string {
  return domainEscalationReason(confidence, advisory);
}
