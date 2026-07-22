import type { EmployeeScoreComponents, FarmerScoreComponents, ScoreFactor } from './opportunity-intelligence.types.js';
export type FarmerScoreSnapshot = {
    farmerId: string;
    opportunityScore: number;
    components: FarmerScoreComponents;
    factors: ScoreFactor[];
    engineVersion: string;
    calculatedAt: string;
};
export type EmployeeScoreSnapshot = {
    employeeProfileId: string;
    performanceScore: number;
    components: EmployeeScoreComponents;
    attributedFarmerCount: number;
    factors: ScoreFactor[];
    engineVersion: string;
    calculatedAt: string;
};
/**
 * Phase 0: read/write score snapshots (engines populate in Phase 3–4).
 */
export declare const opportunityScoreStoreService: {
    getFarmerScore(farmerId: string): Promise<FarmerScoreSnapshot | null>;
    upsertFarmerScore(farmerId: string, components: FarmerScoreComponents, factors: ScoreFactor[]): Promise<FarmerScoreSnapshot>;
    getEmployeeScore(employeeProfileId: string): Promise<EmployeeScoreSnapshot | null>;
    upsertEmployeeScore(employeeProfileId: string, components: EmployeeScoreComponents, factors: ScoreFactor[], attributedFarmerCount: number): Promise<EmployeeScoreSnapshot>;
};
//# sourceMappingURL=opportunity-score-store.service.d.ts.map