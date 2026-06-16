import type { RecommendationOutcome } from '../../domain/ai-training/enums.js';
export type CloseVisitCaseInput = {
    fieldFindingId: string;
    closedBy: string;
    outcome?: RecommendationOutcome;
    notes?: string;
    learningConsent?: boolean;
    issueResolved?: boolean;
};
export declare const visitCaseClosureService: {
    emitTrainingEventForRecommendation(recommendationRecordId: string, agentEmail: string): Promise<string | null>;
    closeCase(input: CloseVisitCaseInput): Promise<{
        fieldFindingId: string;
        closedAt: string;
        closedBy: string;
        trainingEventIds: string[];
        learningSampleRecommendationIds: string[];
        issuesUpdated: number;
        learningConsent: boolean;
    }>;
};
//# sourceMappingURL=visit-case-closure.service.d.ts.map