import { type EmployeeScorePresentation } from './intelligence-score-presentation.service.js';
export type TelecallerPriorityFarmer = {
    leadId: string | null;
    farmerId: string;
    farmerName: string;
    opportunityScore: number;
    riskBand: string | null;
    reason: string;
};
export type TelecallerWorkspaceIntelligence = {
    employee: {
        profileId: string | null;
        performanceScore: number | null;
        relationshipQuality: number | null;
        engagementGrowth: number | null;
        retentionQuality: number | null;
        delayedConversion: number | null;
        attributedFarmers: number | null;
        calculatedAt: string | null;
        isEngineScore: boolean;
    };
    cohort: {
        highOpportunityCount: number;
        atRiskCount: number;
        churnedCount: number;
        openAlertsCount: number;
    };
    priorityFarmers: TelecallerPriorityFarmer[];
    suggestedActions: Array<{
        id: string;
        title: string;
        detail: string;
    }>;
    employeePresentation: EmployeeScorePresentation | null;
};
export declare const telecallerIntelligenceService: {
    getWorkspaceIntelligence(agentEmail: string): Promise<TelecallerWorkspaceIntelligence>;
    enrichLeadRows<T extends {
        farmerId: unknown;
    }>(leads: T[]): Promise<Array<T & {
        opportunityScore: number | null;
        retentionRiskBand: string | null;
    }>>;
};
//# sourceMappingURL=telecaller-intelligence.service.d.ts.map