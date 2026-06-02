export declare function startFarmerOpportunityScoreWorker(): void;
/** Admin / manual trigger — bypasses once-per-day guard. */
export declare function runFarmerOpportunityScoresNow(options?: {
    farmerId?: string;
    limit?: number;
    dryRun?: boolean;
}): Promise<{
    scored: number;
    skipped: number;
    errors: number;
    dryRun: boolean;
}>;
/** Manual employee performance batch (runs after farmers when using nightly worker). */
export declare function runEmployeePerformanceScoresNow(options?: {
    employeeProfileId?: string;
    limit?: number;
    dryRun?: boolean;
}): Promise<{
    scored: number;
    skipped: number;
    errors: number;
    dryRun: boolean;
}>;
//# sourceMappingURL=farmer-opportunity-score.worker.d.ts.map