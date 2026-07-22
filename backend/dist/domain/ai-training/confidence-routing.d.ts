import type { ConfidenceAction, PolicyConfidenceBand } from './enums.js';
import type { StructuredAdvisory } from '../../services/ai/types.js';
export declare function getAutoSendThreshold(): number;
export declare function getReviewThreshold(): number;
/** Legacy escalation threshold — kept for backward compatibility */
export declare function getEscalationThreshold(): number;
/**
 * Route AI output based on confidence score.
 * ≥ auto threshold  → auto_send
 * ≥ review threshold → employee_review
 * else              → escalate
 */
export declare function resolveConfidenceAction(confidence: number): ConfidenceAction;
/** Policy-engine band for crop health scoring (distinct from routing action) */
export declare function toPolicyConfidenceBand(confidence: number): PolicyConfidenceBand;
export declare function shouldAutoSend(confidence: number, advisory: StructuredAdvisory): boolean;
export declare function shouldEscalate(confidence: number, advisory: StructuredAdvisory): boolean;
export declare function escalationReason(confidence: number, advisory: StructuredAdvisory): string;
/** Map follow-up WhatsApp reply → canonical recommendation outcome */
export declare function mapFollowupToRecommendationOutcome(reply: 'improved' | 'partial' | 'no_improvement' | 'worsened'): 'better' | 'partial' | 'no_improvement';
//# sourceMappingURL=confidence-routing.d.ts.map