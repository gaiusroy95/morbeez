export type RetentionSnapshot = {
    riskBand: string;
    daysSinceLastInbound: number | null;
    retentionScore: number | null;
};
/** Batch load retention rows (PostgREST cannot embed farmer_scores ↔ farmer_retention_tracking). */
export declare function fetchRetentionByFarmerIds(farmerIds: string[]): Promise<Map<string, RetentionSnapshot>>;
/** Batch load opportunity scores by farmer id. */
export declare function fetchOpportunityScoresByFarmerIds(farmerIds: string[]): Promise<Map<string, number>>;
//# sourceMappingURL=intelligence-farmer-score-queries.util.d.ts.map