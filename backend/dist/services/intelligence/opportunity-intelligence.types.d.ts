/** Weight caps for farmer opportunity score (sum = 100). */
export declare const FARMER_OPPORTUNITY_WEIGHTS: {
    readonly engagement: 20;
    readonly trust: 15;
    readonly acreSize: 15;
    readonly acrePotential: 20;
    readonly relationship: 10;
    readonly advisoryCooperation: 10;
    readonly cropValue: 5;
    readonly referralInfluence: 5;
};
/** Weight caps for employee performance score (sum = 100). */
export declare const EMPLOYEE_PERFORMANCE_WEIGHTS: {
    readonly engagementGrowth: 20;
    readonly relationshipQuality: 20;
    readonly retentionQuality: 15;
    readonly trustBuilding: 15;
    readonly delayedConversion: 10;
    readonly farmerReactivation: 10;
    readonly knowledgeContribution: 5;
    readonly farmerSatisfaction: 5;
};
export type ScoreFactor = {
    code: string;
    label: string;
    delta?: number;
    evidence?: Record<string, unknown>;
};
export type FarmerScoreComponents = {
    engagement: number;
    trust: number;
    acreSize: number;
    acrePotential: number;
    relationship: number;
    advisoryCooperation: number;
    cropValue: number;
    referralInfluence: number;
};
export type EmployeeScoreComponents = {
    engagementGrowth: number;
    relationshipQuality: number;
    retentionQuality: number;
    trustBuilding: number;
    delayedConversion: number;
    farmerReactivation: number;
    knowledgeContribution: number;
    farmerSatisfaction: number;
};
export declare const OPPORTUNITY_ENGINE_VERSION = "v1";
//# sourceMappingURL=opportunity-intelligence.types.d.ts.map