import type { ConfidenceAction } from '../../domain/ai-training/enums.js';
import type { StructuredAdvisory } from '../ai/types.js';
export type SessionLifecycle = {
    sessionId: string;
    confidenceScore: number | null;
    confidenceBand: ConfidenceAction | null;
    escalationRecommended: boolean;
    autoSent: boolean;
    autoSentAt: string | null;
    humanReviewed: boolean;
    humanReviewedAt: string | null;
    humanReviewedBy: string | null;
    corrected: boolean;
    correctedAt: string | null;
    routingDecidedAt: string | null;
};
export declare const confidenceLifecycleService: {
    /**
     * Persist routing decision after confidence is computed.
     */
    applyRouting(params: {
        sessionId: string;
        confidence: number;
        advisory: StructuredAdvisory;
    }): Promise<{
        band: ConfidenceAction;
        needsEscalation: boolean;
    }>;
    /** Mark session as auto-delivered to farmer (≥95% band, no agronomist gate). */
    markAutoSent(sessionId: string, channel?: string): Promise<void>;
    /** Record agronomist or staff human review on a session. */
    markHumanReviewed(sessionId: string, params: {
        reviewedBy: string;
        corrected?: boolean;
        action?: string;
    }): Promise<void>;
    getLifecycle(sessionId: string): Promise<SessionLifecycle | null>;
    /** Should this advisory be auto-delivered without agronomist gate? */
    canAutoSend(confidence: number, advisory: StructuredAdvisory): boolean;
    /** Aggregate routing stats for dashboards (last N days). */
    getRoutingStats(days?: number): Promise<{
        periodDays: number;
        since: string;
        totalRouted: number;
        byBand: {
            autoSend: number;
            employeeReview: number;
            escalate: number;
            autoSendPct: number;
            employeeReviewPct: number;
            escalatePct: number;
        };
        autoSentCount: number;
        autoSentRatePct: number;
        humanReviewedCount: number;
        humanReviewedRatePct: number;
        correctedCount: number;
        correctionRatePct: number;
        avgConfidencePct: number | null;
        thresholds: {
            autoSend: number;
            employeeReview: number;
        };
    }>;
};
//# sourceMappingURL=confidence-lifecycle.service.d.ts.map