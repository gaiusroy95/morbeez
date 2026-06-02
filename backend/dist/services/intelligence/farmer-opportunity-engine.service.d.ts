import type { FarmerScoreSnapshot } from './opportunity-score-store.service.js';
export declare const farmerOpportunityEngineService: {
    scoreFarmer(farmerId: string): Promise<FarmerScoreSnapshot>;
    listFarmerIdsForBatch(opts?: {
        limit?: number;
        activityDays?: number;
    }): Promise<string[]>;
    runBatch(opts?: {
        limit?: number;
        dryRun?: boolean;
        farmerId?: string;
    }): Promise<{
        scored: number;
        skipped: number;
        errors: number;
        dryRun: boolean;
    }>;
};
//# sourceMappingURL=farmer-opportunity-engine.service.d.ts.map