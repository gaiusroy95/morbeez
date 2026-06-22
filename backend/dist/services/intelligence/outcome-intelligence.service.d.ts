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
    getProtocolFunnelStats(days?: number): Promise<{
        d3: {
            scheduled: number;
            completed: number;
            failed: number;
        };
        d7: {
            scheduled: number;
            completed: number;
            failed: number;
        };
        d14: {
            scheduled: number;
            completed: number;
            failed: number;
        };
    }>;
    compareVariantsByExperiment(experimentId: string): Promise<Array<{
        variantKey: string;
        sampleCount: number;
        recoveryPct: number;
        avgCostInr: number | null;
    }>>;
};
//# sourceMappingURL=outcome-intelligence.service.d.ts.map