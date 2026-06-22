export type OutcomeProtocolStats = {
    issueLabel: string;
    protocolLabel: string;
    sampleCount: number;
    recoveryPct: number;
    avgRecoveryDays: number | null;
};
export declare const outcomeIntelligenceService: {
    recordVariant(input: {
        fieldFindingId?: string;
        recommendationRecordId?: string;
        issueLabel: string;
        protocolLabel: string;
        costInr?: number;
        expectedRecoveryPct?: number;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    updateVariantOutcome(recommendationRecordId: string, outcome: string, recoveryDays?: number): Promise<void>;
    aggregateByIssue(issueLabel?: string, limit?: number): Promise<OutcomeProtocolStats[]>;
    rankVerifiedCasesForRetrieval(issueLabel: string): Promise<string[]>;
};
//# sourceMappingURL=outcome-intelligence.service.d.ts.map