import type { ExpertCaseReviewDraft } from '@morbeez/shared/expert-case';
export declare const expertCaseCommitMapperService: {
    persistStructuredOutputs(params: {
        caseId: string;
        farmerId: string;
        blockId?: string | null;
        actorEmail: string;
        commandId: string;
        draft: ExpertCaseReviewDraft;
    }): Promise<{
        recommendationId?: string | null;
        activityIds: string[];
    }>;
};
//# sourceMappingURL=expert-case-commit-mapper.service.d.ts.map