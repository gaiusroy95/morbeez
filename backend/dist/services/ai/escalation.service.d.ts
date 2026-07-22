import type { AdvisoryLanguage, PlantIdHealthResult, StructuredAdvisory } from './types.js';
export declare const OPEN_ESCALATION_STATUSES: readonly ["pending", "assigned", "in_review"];
export type CreateCaseForReviewInput = {
    sessionId: string;
    farmerId: string;
    reason: string;
    confidence_at_escalation: number;
    priority?: string;
};
/**
 * Always insert a new case-review row (multiple requests per farmer appear separately in the queue).
 */
export declare const escalationService: {
    createCaseForReview(params: CreateCaseForReviewInput): Promise<{
        escalationId: string;
    }>;
    /** @deprecated Use createCaseForReview — kept for callers; always creates a new row. */
    ensureOpenEscalation(params: CreateCaseForReviewInput): Promise<{
        escalationId: string;
        created: boolean;
    }>;
    /**
     * Record every Crop Doctor / advisory session in Case Review.
     * `escalated` flag still reflects low-confidence rules for farmer messaging & events.
     */
    createIfNeeded(params: {
        sessionId: string;
        farmerId: string;
        advisory: StructuredAdvisory;
        plantId?: PlantIdHealthResult | null;
    }): Promise<{
        escalated: boolean;
        escalationId: string;
        confidence: number;
    }>;
    /** Text-only or agronomy WhatsApp turn — creates session + output + case row. */
    enqueueWhatsAppInquiry(params: {
        farmerId: string;
        language: AdvisoryLanguage;
        symptomsText: string;
        farmerSummary: string;
        probableIssue?: string;
        confidence?: number;
        channel?: "whatsapp" | "api" | "web";
        imageStoragePath?: string | null;
    }): Promise<{
        sessionId: string;
        escalationId: string;
    } | null>;
};
//# sourceMappingURL=escalation.service.d.ts.map