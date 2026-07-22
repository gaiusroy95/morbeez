export declare const executionVerificationService: {
    verify(params: {
        farmerId: string;
        sessionId: string;
        recommendationRecordId?: string | null;
    }): Promise<{
        score: number;
        checks: string[];
    }>;
};
//# sourceMappingURL=execution-verification.service.d.ts.map