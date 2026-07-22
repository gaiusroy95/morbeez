declare function mapTaskRow(t: Record<string, unknown>): {
    id: string;
    title: string;
    dueLabel: string | undefined;
    isDueToday: boolean;
    status: string;
    farmerName: string;
    leadId: string | undefined;
    dueAt: string | null;
    taskType: string | undefined;
    category: string;
};
export declare const telecallerMobileService: {
    getDashboard(agentEmail: string): Promise<{
        overview: {
            monthlyTarget: number;
            openEscalations: number;
            callsToday: number;
            pendingFollowUps: number;
            followUpsDueToday: number;
            interestedFarmers: number;
            ordersGenerated: number;
            revenue: number;
            conversionRate: number;
            myLeadsCount: number;
            allLeadsCount: number;
        };
        qc: {
            callsToday: number;
            totalCalls: number;
            averageScore: number;
            interested: number;
            soilTestInterest: number;
            flaggedCalls: number;
        };
        queueHealth: {
            newMetaLeadsWaiting: number;
            oldestWaitingHours: number | null;
            slaTargetHours: number;
        } | null;
        actionQueue: {
            id: string;
            category: string;
            label: string;
            count: number;
            leadId?: string;
            farmerName?: string;
        }[];
        todaysTasks: {
            id: string;
            title: string;
            dueLabel: string | undefined;
            isDueToday: boolean;
            status: string;
            farmerName: string;
            leadId: string | undefined;
            dueAt: string | null;
            taskType: string | undefined;
            category: string;
        }[];
        escalations: number;
    }>;
    listLeads(agentEmail: string, query: {
        scope?: "mine" | "all";
        limit?: number;
    }): Promise<({
        id: unknown;
        farmerId: unknown;
        intent: unknown;
        source: unknown;
        status: unknown;
        stage: import("../admin/telecaller-admin.service.js").LeadStage;
        stageLabel: string;
        priority: unknown;
        assignedTo: unknown;
        notes: unknown;
        followUpAt: unknown;
        followUpLabel: string | null;
        lastInteractionAt: unknown;
        lastInteractionLabel: string | null;
        leadScore: number;
        createdAt: unknown;
        campaignSource: {} | null;
        leadChannel: {} | null;
        marketingOwnerId: {} | null;
        marketingOwnerName: {} | null;
        utmCampaign: {} | null;
        utmSource: {} | null;
        utmMedium: {} | null;
        attributionBadge: string | null;
        farmerName: string;
        farmerInitials: string;
        phone: string | null;
        district: {} | null;
        state: {} | null;
        farmerStatus: string;
    } & {
        opportunityScore: number | null;
        retentionRiskBand: string | null;
    })[]>;
    listOperationalLeads(agentEmail: string, query: {
        scope?: "mine" | "all";
        search?: string;
        smartFilter?: string;
        sort?: string;
        limit?: number;
    }): Promise<{
        id: string;
        farmerId: string;
        farmerName: string;
        phone: string | null;
        district: string | null;
        village: string | null;
        stageLabel: string;
        stage: string;
        primaryCrop: string | null;
        healthStatus: string | null;
        openTaskCount: number;
        pendingTasksCount: number;
        escalationCount: number;
        opportunityScore: number | null;
        priorityLabel: string | undefined;
        lastInteractionLabel: string | null;
        followUpLabel: string | null | undefined;
        isOverdue: boolean;
        isDueToday: boolean;
        acreage: number | null;
    }[]>;
    getQueueSummary(agentEmail: string, scope?: "mine" | "all"): Promise<{
        pendingTasks: number;
        escalations: number;
        dueToday: number;
        hotLeads: number;
        highOpportunity: number;
        atRisk: number;
        overdue: number;
    }>;
    listFollowUps(agentEmail: string, status?: string): Promise<{
        id: any;
        title: any;
        dueLabel: string | null;
        isDueToday: boolean;
        status: any;
        farmerName: string;
        phone: unknown;
        leadId: any;
        stage: string | undefined;
    }[]>;
    listFollowUpSections(agentEmail: string): Promise<{
        today: ReturnType<typeof mapTaskRow>[];
        overdue: ReturnType<typeof mapTaskRow>[];
        upcoming: ReturnType<typeof mapTaskRow>[];
        recommendationReviews: ReturnType<typeof mapTaskRow>[];
        visitFollowUps: ReturnType<typeof mapTaskRow>[];
        orderFollowUps: ReturnType<typeof mapTaskRow>[];
        general: ReturnType<typeof mapTaskRow>[];
    }>;
    listTodaysTasks(agentEmail: string): Promise<{
        id: string;
        title: string;
        dueLabel: string | undefined;
        isDueToday: boolean;
        status: string;
        farmerName: string;
        leadId: string | undefined;
        dueAt: string | null;
        taskType: string | undefined;
        category: string;
    }[]>;
    countOpenEscalations(agentEmail: string): Promise<number>;
    buildActionQueue(agentEmail: string): Promise<{
        id: string;
        category: string;
        label: string;
        count: number;
        leadId?: string;
        farmerName?: string;
    }[]>;
    getWorkspaceSummary(leadId: string): Promise<{
        leadId: string;
        farmerId: string;
        farmer: {
            id: string;
            name: string;
            phone: string | null;
            district: string | null;
            village: string | null;
            language: string | null;
            acreage: number | null;
        };
        lead: {
            stage: string;
            stageLabel: string;
            assignedTelecaller: string | null;
            assignedAgronomist: string | null;
            leadSource: string | null;
            campaign: string | null;
            tags: never[];
            customerSince: string | null;
            ownership: string | null;
            serviceModel: import("../partner/partner.types.js").ServiceModel | null;
            assignedPartnerId: string | null;
            assignedPartnerName: string | null;
            enrollmentSource: string | null;
        };
        ownership: import("../partner/partner.types.js").FarmerOwnership | null;
        intelligence: {
            opportunityScore: number | null;
            relationshipScore: number | null;
            revenueGenerated: number | null;
        };
        healthStatus: string;
        activeCrops: string[];
        dap: number;
        lastVisitAt: string | null;
        lastInteractionAt: string | null;
        pendingTaskCount: number;
        openEscalationCount: number;
        openRecommendationsCount: number;
        lastOrderAt: string | null;
        blockCount: number;
        profile: Record<string, unknown> | null;
    }>;
    listNotifications(agentEmail: string): Promise<{
        id: string;
        category: string;
        title: string;
        detail?: string | null;
        at: string;
        leadId?: string;
        taskId?: string;
    }[]>;
};
export {};
//# sourceMappingURL=telecaller-mobile.service.d.ts.map