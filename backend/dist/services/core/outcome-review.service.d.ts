import type { RecommendationOutcome } from '../../domain/ai-training/enums.js';
export type OutcomeReviewQueueFilter = 'pending' | 'overdue' | 'needs_review' | 'all';
export type RecordStructuredOutcomeInput = {
    outcome: RecommendationOutcome;
    notes?: string;
    recoveryDays?: number;
    farmerFeedback?: string;
    agronomistFeedback?: string;
    issueResolved?: boolean;
};
export declare const outcomeReviewService: {
    listQueue(params: {
        filter?: OutcomeReviewQueueFilter;
        page?: number;
        limit?: number;
    }): Promise<{
        items: {
            id: string;
            farmerId: string;
            blockId: string | null;
            aiSessionId: string | null;
            issueDetected: string | null;
            recommendationText: string;
            dosage: string | null;
            status: string;
            applicationStatus: string | null;
            outcome: string | null;
            outcomeNotes: string | null;
            recoveryDays: number | null;
            issueResolved: boolean | null;
            communicatedAt: string | null;
            appliedAt: string | null;
            outcomeAt: string | null;
            dapAtRecommendation: number | null;
            source: string | null;
            createdAt: string;
            outcomeKpi: Record<string, unknown> | null;
            needsHumanOutcomeReview: boolean;
            humanOutcomeReviewReason: string | null;
            farmer: {
                name: string | null;
                phone: string | null;
                district: string | null;
            } | null;
            block: {
                name: string;
                cropType: string;
                plotLabel: string | null;
            } | null;
            pendingFollowUp: {
                id: string;
                phase: string;
                status: string;
                scheduledAt: string;
                farmerResponse: string | null;
            } | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
        pendingCount: number;
    }>;
    getDetail(recommendationId: string): Promise<{
        recommendation: {
            id: string;
            farmerId: string;
            blockId: string | null;
            aiSessionId: string | null;
            issueDetected: string | null;
            recommendationText: string;
            dosage: string | null;
            status: string;
            applicationStatus: string | null;
            outcome: string | null;
            outcomeNotes: string | null;
            recoveryDays: number | null;
            issueResolved: boolean | null;
            communicatedAt: string | null;
            appliedAt: string | null;
            outcomeAt: string | null;
            dapAtRecommendation: number | null;
            source: string | null;
            createdAt: string;
            outcomeKpi: Record<string, unknown> | null;
            needsHumanOutcomeReview: boolean;
            humanOutcomeReviewReason: string | null;
            farmer: {
                name: string | null;
                phone: string | null;
                district: string | null;
            } | null;
            block: {
                name: string;
                cropType: string;
                plotLabel: string | null;
            } | null;
            pendingFollowUp: {
                id: string;
                phase: string;
                status: string;
                scheduledAt: string;
                farmerResponse: string | null;
            } | null;
        };
        application: any;
        followUps: any[];
        session: {
            id: any;
            confidence_score: any;
            status: any;
            created_at: any;
        } | null;
    }>;
    recordOutcome(recommendationId: string, input: RecordStructuredOutcomeInput, agentEmail: string): Promise<any>;
};
//# sourceMappingURL=outcome-review.service.d.ts.map