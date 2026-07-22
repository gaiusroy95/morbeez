export type CaseReviewCommitInput = {
    caseId: string;
    commandId?: string;
    idempotencyKey: string;
    actorEmail: string;
    leaseToken?: string | null;
    expectedRevision: number;
    draft: {
        diagnosis?: string | null;
        confidence?: number | null;
        severity?: string | null;
        recommendationText?: string | null;
        dosage?: string | null;
        followUpDays?: number | null;
        recoveryStatus?: string | null;
        knowledgeCandidate?: boolean;
        notes?: string | null;
        [key: string]: unknown;
    };
    safetyDecisionId?: string | null;
    closeCase?: boolean;
    summary?: Record<string, unknown>;
};
export declare function buildExpertCaseCommitRequestHash(input: Pick<CaseReviewCommitInput, 'caseId' | 'expectedRevision' | 'draft' | 'closeCase'>): string;
export declare const expertCaseCommitService: {
    enabled(): boolean;
    commitCaseReview(input: CaseReviewCommitInput): Promise<{
        commandId: string;
        caseId: string;
        revision: number;
        closed: boolean;
        communicationIntentId?: string | null;
        knowledgeCandidateId?: string | null;
    }>;
};
//# sourceMappingURL=expert-case-commit.service.d.ts.map