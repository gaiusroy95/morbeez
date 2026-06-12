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
    listFarmerRecommendations(farmerId: string, limit?: number): Promise<{
        id: string;
        farmerId: string;
        blockId: string | null;
        fieldFindingId: string | null;
        issueDetected: string | null;
        recommendationText: string;
        dosage: string | null;
        status: string;
        createdAt: string;
    }[]>;
    createFarmerRecommendation(farmerId: string, createdBy: string, input: {
        blockId?: string;
        leadId?: string;
        fieldFindingId?: string;
        issueDetected?: string;
        recommendationText: string;
        dosage?: string;
        weatherWarning?: string;
        language?: string;
    }): Promise<any>;
    getBlockDetail(farmerId: string, blockId: string): Promise<{
        block: {
            latestFindingLabel: string | null;
            latestFieldActivity: string | null;
            latestSoilTestAt: string | null;
            needsAttention: boolean;
            cropHealthLabel: string;
            cropHealthStatus: string;
            lastVisitAt: string | null;
            lastVisitDap: number | null;
            soilHealth: string;
            soilHealthLabel: string;
            soilHealthStatus: string;
            id: string;
            name: string;
            cropType: string;
            plotLabel: string | null;
            dap: number;
            plantingDate: string | null;
            latitude: number | null;
            longitude: number | null;
            hasPlotGps: boolean;
            acreage: number | null;
            area: string | null;
        };
        activities: {
            id: string;
            blockId: string;
            blockName: string;
            activityType: string;
            activityLabel: string;
            activityDate: string;
            dateLabel: string;
            notes: string | null;
            costInr: number | null;
            status: string;
        }[];
        soilReports: {
            id: string;
            blockId: string;
            blockName: string;
            dateLabel: string;
            dapLabel: null;
            health: string;
            healthLabel: string;
            pdfUrl: string | null;
            highlights: never[];
            metrics: never[];
        }[];
        fieldFindings: {
            id: string;
            visitedAt: string;
            visitedLabel: string;
            diseasePest: string | null;
            observations: string | null;
            diseaseTone: string;
            cropHealthLabel: string;
            cropHealthStatus: "critical" | "stable" | "monitor" | "alert";
            agronomistName: string | null;
            actionTaken: string | null;
        }[];
        blockRecommendations: ({
            id: string;
            title: string;
            body: string;
            dosage: string | null;
            dateLabel: string;
            status: string;
            recommendedBy: string | null;
            source: "crm";
        } | {
            id: string;
            title: string;
            body: string;
            dosage: string | null;
            dateLabel: string;
            status: string;
            recommendedBy: string | null;
            source: "record";
        })[];
    }>;
};
//# sourceMappingURL=agronomist-mobile.service.d.ts.map