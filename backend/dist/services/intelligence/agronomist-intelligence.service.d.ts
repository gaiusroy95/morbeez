export type AgronomistWorkspaceIntelligence = {
    employee: {
        profileId: string | null;
        performanceScore: number | null;
        trustBuilding: number | null;
        knowledgeContribution: number | null;
        relationshipQuality: number | null;
        attributedFarmers: number | null;
        calculatedAt: string | null;
    };
    cohort: {
        openEscalations: number;
        highOpportunityFarmers: number;
        farmersNeedingTrust: number;
    };
    focusFarmers: Array<{
        farmerId: string;
        farmerName: string;
        opportunityScore: number | null;
        riskBand: string | null;
        reason: string;
    }>;
};
export declare const agronomistIntelligenceService: {
    getWorkspaceIntelligence(agentEmail: string): Promise<AgronomistWorkspaceIntelligence>;
};
//# sourceMappingURL=agronomist-intelligence.service.d.ts.map