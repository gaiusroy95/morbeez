/**
 * Merges GPT + Plant.id signals and delegates routing to the AI training domain.
 * @see backend/src/domain/ai-training/confidence-routing.ts
 */
import type { PlantIdHealthResult, StructuredAdvisory } from './types.js';
import { shouldAutoSend, resolveConfidenceAction, getEscalationThreshold } from '../../domain/ai-training/confidence-routing.js';
export { getEscalationThreshold, resolveConfidenceAction, shouldAutoSend };
/** Merge Plant.id signal with GPT self-reported confidence */
export declare function computeConfidence(gptConfidence: number, plantId?: PlantIdHealthResult | null): number;
export declare function shouldEscalate(confidence: number, advisory: StructuredAdvisory): boolean;
export declare function escalationReason(confidence: number, advisory: StructuredAdvisory): string;
//# sourceMappingURL=confidence.d.ts.map