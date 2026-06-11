export declare const agronomistMobileService: {
    getMobileDashboard(agentEmail: string): Promise<{
        todaysVisits: number;
        routesToday: number;
        pendingFollowUps: number;
        pendingCallbacks: number;
        openEscalations: number;
        newSoilReports: number;
        aiReviewCases: number;
        findingReviewQueue: number;
        focusFarmers: {
            farmerId: string;
            farmerName: string;
            opportunityScore: number | null;
            riskBand: string | null;
            reason: string;
        }[];
    }>;
    listMobileFarmers(agentEmail: string, opts: {
        q?: string;
        filter?: string;
        lat?: number;
        lng?: number;
        limit?: number;
    }): Promise<{
        acreage: number | null;
        primaryCrop: string;
        dap: number;
        distanceKm: number | null;
        healthStatus: string;
        lastVisitAt: string | null;
        openTaskCount: number;
        id: string;
        phone: string | null | undefined;
        name: string;
        district: string | null | undefined;
        village: string | null | undefined;
        preferredLanguage: string;
    }[]>;
    getWorkspaceSummary(farmerId: string): Promise<{
        farmer: {
            id: string;
            name: string;
            phone: string | null;
            district: string | null;
            acreage: number | null;
        };
        leadId: string | null;
        healthStatus: string;
        activeCrops: string[];
        dap: number;
        lastVisitAt: string | null;
        pendingTaskCount: number;
        openEscalationCount: number;
    }>;
    listFarmerDocuments(farmerId: string): Promise<{
        id: string;
        type: string;
        title: string;
        url: string | null;
        createdAt: string;
    }[]>;
    listUnifiedTasks(agentEmail: string, filter?: string): Promise<{
        id: string;
        kind: string;
        title: string;
        subtitle: string;
        dueAt: string | null;
        status: string;
        farmerId?: string | null;
        leadId?: string | null;
        refId?: string;
    }[]>;
    listCallbacks(_agentEmail: string): Promise<{
        id: string;
        farmerId: string;
        farmerName: string | null;
        phone: string | null;
        reason: string | null;
        status: string;
        requestedAt: string;
        dueAt: string | null;
    }[]>;
    updateCallback(id: string, status: string): Promise<any>;
    createCallback(agentEmail: string, input: {
        farmerId: string;
        reason: string;
        dueInDays?: number;
    }): Promise<any>;
    listEscalations(opts?: {
        status?: string;
        farmerId?: string;
    }): Promise<{
        id: string;
        farmerId: string | null;
        farmerName: string | null;
        type: string;
        status: string;
        summary: string | null;
        createdAt: string;
    }[]>;
    getProfileStats(agentEmail: string): Promise<{
        assignedFarmers: number;
        visitsCompleted: number;
        recommendationsGiven: number;
        recoverySuccessRate: number | null;
        performanceScore: number | null;
        openEscalations: number;
    }>;
    startVisitSession(input: {
        farmerId: string;
        blockId?: string;
        agronomistEmail: string;
        latitude?: number;
        longitude?: number;
    }): Promise<any>;
    checkOutVisitSession(sessionId: string, input: {
        latitude?: number;
        longitude?: number;
        fieldFindingId?: string;
    }): Promise<any>;
};
//# sourceMappingURL=agronomist-mobile.service.d.ts.map