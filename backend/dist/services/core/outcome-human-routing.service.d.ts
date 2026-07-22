import type { ImprovementLevel, OutcomeKpiPayload } from '../../domain/ai-training/outcome-kpi.js';
export type HumanReviewDecision = {
    needsHumanReview: boolean;
    reasons: string[];
};
export declare const outcomeHumanRoutingService: {
    decide(params: {
        farmerId: string;
        recommendationRecordId: string;
        improvementLevel: ImprovementLevel;
        kpi: OutcomeKpiPayload;
        severity: string | null;
        aiSessionConfidence?: number | null;
        farmerMetadata?: Record<string, unknown>;
    }): Promise<HumanReviewDecision>;
    countRecentFailedOutcomes(farmerId: string): Promise<number>;
    formatReasonsForStaff(reasons: string[]): string;
};
//# sourceMappingURL=outcome-human-routing.service.d.ts.map