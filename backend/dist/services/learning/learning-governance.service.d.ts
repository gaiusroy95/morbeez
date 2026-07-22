export type SubmitCandidateInput = {
    candidateType: string;
    claimKey: string;
    payload: Record<string, unknown>;
    caseId?: string | null;
    proposedBy: string;
    sourceEventIds?: string[];
    riskClass?: 'standard' | 'high' | 'critical';
    scope?: string;
};
export declare const learningGovernanceService: {
    shadowEnabled(): boolean;
    legacyPromotionDisabled(): boolean;
    approvedReuseReadsEnabled(): boolean;
    recordEvidence(params: {
        eventType: string;
        sourceSurface: string;
        aggregateType: string;
        aggregateId: string;
        actorEmail?: string | null;
        farmerId?: string | null;
        caseId?: string | null;
        payload?: Record<string, unknown>;
        idempotencyKey?: string;
    }): Promise<string>;
    submitCandidate(input: SubmitCandidateInput): Promise<{
        id: string;
        status: string;
    }>;
    reviewCandidate(params: {
        candidateId: string;
        reviewerEmail: string;
        verdict: "approve" | "reject" | "needs_evidence";
        notes?: string;
        reasonCodes?: string[];
    }): Promise<{
        candidateId: string;
        status: string;
        knowledgeVersionId?: string | null;
    }>;
    publishApprovedCandidate(params: {
        candidate: Record<string, unknown>;
        reviewerEmail: string;
    }): Promise<string>;
    findApprovedReuse(params: {
        cropType?: string | null;
        district?: string | null;
        symptomKey: string;
    }): Promise<Record<string, unknown> | null>;
};
//# sourceMappingURL=learning-governance.service.d.ts.map