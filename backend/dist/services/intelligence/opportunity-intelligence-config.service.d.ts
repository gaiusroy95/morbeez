import { EMPLOYEE_PERFORMANCE_WEIGHTS, FARMER_OPPORTUNITY_WEIGHTS } from './opportunity-intelligence.types.js';
import type { FarmerScoreComponents } from './opportunity-intelligence.types.js';
import type { EmployeeScoreComponents } from './opportunity-intelligence.types.js';
export type AlertThresholds = {
    highOpportunityMin: number;
    lowOpportunityMax: number;
    autoCreateCrmTasks: boolean;
    autoNurtureLowScore: boolean;
    employeeAtRiskCohortPct: number;
};
export type OpportunityIntelligenceConfig = {
    id: string;
    farmerWeightOverrides: Partial<typeof FARMER_OPPORTUNITY_WEIGHTS>;
    employeeWeightOverrides: Partial<typeof EMPLOYEE_PERFORMANCE_WEIGHTS>;
    alertThresholds: AlertThresholds;
    effectiveFarmerWeights: typeof FARMER_OPPORTUNITY_WEIGHTS;
    effectiveEmployeeWeights: typeof EMPLOYEE_PERFORMANCE_WEIGHTS;
    updatedAt: string;
};
export declare const opportunityIntelligenceConfigService: {
    get(): Promise<OpportunityIntelligenceConfig>;
    update(input: {
        farmerWeightOverrides?: Partial<typeof FARMER_OPPORTUNITY_WEIGHTS>;
        employeeWeightOverrides?: Partial<typeof EMPLOYEE_PERFORMANCE_WEIGHTS>;
        alertThresholds?: Partial<AlertThresholds>;
        updatedByAdminId?: string;
    }): Promise<OpportunityIntelligenceConfig>;
    /** Rescale component points when admin adjusts max weights (Phase 6 calibration). */
    applyFarmerWeightOverrides(components: FarmerScoreComponents, weights: typeof FARMER_OPPORTUNITY_WEIGHTS): FarmerScoreComponents;
    applyEmployeeWeightOverrides(components: EmployeeScoreComponents, weights: typeof EMPLOYEE_PERFORMANCE_WEIGHTS): EmployeeScoreComponents;
};
//# sourceMappingURL=opportunity-intelligence-config.service.d.ts.map