import { env } from '../../config/env.js';
export function getAutoSendThreshold() {
    return env.AI_AUTO_SEND_THRESHOLD;
}
export function getReviewThreshold() {
    return env.AI_REVIEW_THRESHOLD;
}
/** Legacy escalation threshold — kept for backward compatibility */
export function getEscalationThreshold() {
    return env.AI_ESCALATION_THRESHOLD;
}
/**
 * Route AI output based on confidence score.
 * ≥ auto threshold  → auto_send
 * ≥ review threshold → employee_review
 * else              → escalate
 */
export function resolveConfidenceAction(confidence) {
    const score = Math.max(0, Math.min(1, confidence));
    if (score >= getAutoSendThreshold())
        return 'auto_send';
    if (score >= getReviewThreshold())
        return 'employee_review';
    return 'escalate';
}
/** Policy-engine band for crop health scoring (distinct from routing action) */
export function toPolicyConfidenceBand(confidence) {
    if (confidence > 0.9)
        return 'high';
    if (confidence >= 0.7)
        return 'medium';
    return 'low';
}
export function shouldAutoSend(confidence, advisory) {
    if (advisory.uncertain || advisory.escalationRecommended)
        return false;
    if (!advisory.probableIssue?.trim())
        return false;
    if (/uncertain|unknown|cannot|unclear/i.test(advisory.probableIssue))
        return false;
    return resolveConfidenceAction(confidence) === 'auto_send';
}
export function shouldEscalate(confidence, advisory) {
    if (advisory.uncertain || advisory.escalationRecommended)
        return true;
    if (resolveConfidenceAction(confidence) === 'escalate')
        return true;
    if (!advisory.probableIssue || advisory.probableIssue.toLowerCase().includes('uncertain')) {
        return true;
    }
    return false;
}
export function escalationReason(confidence, advisory) {
    if (advisory.escalationReason)
        return advisory.escalationReason;
    if (advisory.uncertain)
        return 'AI marked diagnosis as uncertain';
    const action = resolveConfidenceAction(confidence);
    if (action === 'escalate') {
        return `Confidence ${(confidence * 100).toFixed(0)}% below review threshold ${getReviewThreshold() * 100}%`;
    }
    return 'Manual agronomist review recommended';
}
/** Map follow-up WhatsApp reply → canonical recommendation outcome */
export function mapFollowupToRecommendationOutcome(reply) {
    if (reply === 'improved')
        return 'better';
    if (reply === 'partial')
        return 'partial';
    return 'no_improvement';
}
//# sourceMappingURL=confidence-routing.js.map