export declare const reviewerRiskService: {
    enabled(): boolean;
    assertCanApprove(reviewerEmail: string): Promise<void>;
    recordSignal(params: {
        reviewerEmail: string;
        signalType: string;
        severity?: string;
        detail?: Record<string, unknown>;
    }): Promise<void>;
    observeReview(params: {
        reviewerEmail: string;
        verdict: string;
        candidateId: string;
    }): Promise<void>;
    quarantineApprovals(params: {
        reviewerEmail: string;
        reason: string;
        createdBy?: string;
    }): Promise<void>;
};
//# sourceMappingURL=reviewer-risk.service.d.ts.map