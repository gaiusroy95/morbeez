import { env } from '../../config/env.js';
import type { ConfidenceAction, PolicyConfidenceBand } from './enums.js';
import type { StructuredAdvisory } from '../../services/ai/types.js';

export function getAutoSendThreshold(): number {
  return env.AI_AUTO_SEND_THRESHOLD;
}

export function getReviewThreshold(): number {
  return env.AI_REVIEW_THRESHOLD;
}

/** Legacy escalation threshold — kept for backward compatibility */
export function getEscalationThreshold(): number {
  return env.AI_ESCALATION_THRESHOLD;
}

/**
 * Route AI output based on confidence score.
 * ≥ auto threshold  → auto_send
 * ≥ review threshold → employee_review
 * else              → escalate
 */
export function resolveConfidenceAction(confidence: number): ConfidenceAction {
  const score = Math.max(0, Math.min(1, confidence));
  if (score >= getAutoSendThreshold()) return 'auto_send';
  if (score >= getReviewThreshold()) return 'employee_review';
  return 'escalate';
}

/** Policy-engine band for crop health scoring (distinct from routing action) */
export function toPolicyConfidenceBand(confidence: number): PolicyConfidenceBand {
  if (confidence > 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

export function shouldAutoSend(confidence: number, advisory: StructuredAdvisory): boolean {
  if (advisory.uncertain || advisory.escalationRecommended) return false;
  if (!advisory.probableIssue?.trim()) return false;
  if (/uncertain|unknown|cannot|unclear/i.test(advisory.probableIssue)) return false;
  return resolveConfidenceAction(confidence) === 'auto_send';
}

export function shouldEscalate(confidence: number, advisory: StructuredAdvisory): boolean {
  if (advisory.uncertain || advisory.escalationRecommended) return true;
  if (resolveConfidenceAction(confidence) === 'escalate') return true;
  if (!advisory.probableIssue || advisory.probableIssue.toLowerCase().includes('uncertain')) {
    return true;
  }
  return false;
}

export function escalationReason(confidence: number, advisory: StructuredAdvisory): string {
  if (advisory.escalationReason) return advisory.escalationReason;
  if (advisory.uncertain) return 'AI marked diagnosis as uncertain';
  const action = resolveConfidenceAction(confidence);
  if (action === 'escalate') {
    return `Confidence ${(confidence * 100).toFixed(0)}% below review threshold ${getReviewThreshold() * 100}%`;
  }
  return 'Manual agronomist review recommended';
}

/** Map follow-up WhatsApp reply → canonical recommendation outcome */
export function mapFollowupToRecommendationOutcome(
  reply: 'improved' | 'partial' | 'no_improvement' | 'worsened'
): 'better' | 'partial' | 'no_improvement' {
  if (reply === 'improved') return 'better';
  if (reply === 'partial') return 'partial';
  return 'no_improvement';
}
