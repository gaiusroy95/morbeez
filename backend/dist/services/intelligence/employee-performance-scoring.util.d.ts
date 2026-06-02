import type { EmployeeScoreComponents, ScoreFactor } from './opportunity-intelligence.types.js';
export declare const MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD = 10;
export type EmployeePerformanceSignals = {
    attributedFarmerCount: number;
    inboundEvents30d: number;
    inboundEventsPrev30d: number;
    outboundEvents30d: number;
    crmTasksCompleted30d: number;
    avgFarmerRelationshipScore: number | null;
    avgFarmerOpportunityScore: number | null;
    healthyRetentionPct: number | null;
    trustEvents90d: number;
    conversionAssists180d: number;
    reactivations90d: number;
    recommendationsApproved90d: number;
    recommendationsCommunicated90d: number;
    positiveOutcomes90d: number;
    activityEvidence30d: number;
};
export declare function scoreEngagementGrowth(signals: EmployeePerformanceSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreRelationshipQuality(signals: EmployeePerformanceSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreRetentionQuality(signals: EmployeePerformanceSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreTrustBuilding(signals: EmployeePerformanceSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreDelayedConversion(signals: EmployeePerformanceSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreFarmerReactivation(signals: EmployeePerformanceSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreKnowledgeContribution(signals: EmployeePerformanceSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreFarmerSatisfaction(signals: EmployeePerformanceSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function computeEmployeeScoreComponents(signals: EmployeePerformanceSignals): {
    components: EmployeeScoreComponents;
    factors: ScoreFactor[];
};
export declare function performanceBreakdownFromComponents(components: EmployeeScoreComponents): Array<{
    label: string;
    pct: number;
}>;
export declare function performanceLabel(score: number): string;
//# sourceMappingURL=employee-performance-scoring.util.d.ts.map