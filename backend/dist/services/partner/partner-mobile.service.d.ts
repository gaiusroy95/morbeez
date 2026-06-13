import type { StructuredFieldVisitInput } from '../../domain/ai-training/validators.js';
export declare const partnerMobileService: {
    getDashboard(partnerId: string): Promise<{
        activeFarmers: number;
        pendingTasks: number;
        visitsThisMonth: number;
        reliabilityScore: number;
        performanceScore: number;
        leadOffersPending: number;
    }>;
    listTasks(partnerId: string): Promise<{
        id: string;
        title: string;
        taskType: string;
        taskCategory: string;
        dueAt: string | null;
        status: string;
        farmerId: string | null;
        leadId: string | null;
        blockId: string | null;
        priority: string;
    }[]>;
    acceptTask(taskId: string, partnerId: string): Promise<any>;
    completeTask(taskId: string, partnerId: string): Promise<any>;
    startVisitSession(input: {
        partnerId: string;
        farmerId: string;
        blockId?: string;
        latitude?: number;
        longitude?: number;
    }): Promise<any>;
    checkOutVisitSession(sessionId: string, partnerId: string, input: {
        latitude?: number;
        longitude?: number;
        fieldFindingId?: string;
    }): Promise<any>;
    submitVisit(input: StructuredFieldVisitInput, partnerId: string, partnerName: string): Promise<{
        findingId: string;
        finding: {
            id: unknown;
            visitedAt: string | null;
            visitedLabel: string;
            blockId: string | null;
            blockName: string;
            cropType: string;
            agronomistName: unknown;
            agronomistRole: {};
            agronomistInitials: string;
            observations: {};
            parameters: {
                label: string;
                value: string;
            }[];
            diseasePest: {};
            diseaseTone: string;
            diseaseLabel: string;
            actionTaken: {};
            followUpAt: string | null;
            followUpLabel: string;
            photoUrls: string[];
            photoCount: number;
            extraPhotoCount: number;
            findingType: string | null;
            severity: string | null;
            affectedAreaPct: number | null;
            aiPrediction: string | null;
            finalConfirmedIssue: string | null;
            weatherContext: Record<string, unknown>;
            weatherSnapshotId: string | null;
        };
        issues: {
            id: string;
            issueName: string;
        }[];
        recommendationIds: string[];
    }>;
    rejectTask(taskId: string, partnerId: string, reason: string): Promise<any>;
    rescheduleTask(taskId: string, partnerId: string, dueAt: string): Promise<any>;
    listVisits(partnerId: string, limit?: number): Promise<{
        id: string;
        farmerId: string;
        blockId: string | null;
        visitedAt: string;
        summary: string;
    }[]>;
    listNotifications(partnerId: string): Promise<{
        id: string;
        category: string;
        title: string;
        detail?: string;
        at: string;
        farmerId?: string;
        taskId?: string;
    }[]>;
    assertFarmerAccess(partnerId: string, farmerId: string): Promise<void>;
    getFarmerWorkspace(partnerId: string, farmerId: string): Promise<{
        farmer: {
            id: any;
            name: any;
            phone: any;
            village: any;
            district: any;
            service_model: any;
            preferred_language: any;
            total_acreage: any;
            assigned_telecaller_email: any;
            assigned_expert_email: any;
        } | null;
        blocks: {
            latestFindingLabel: string | null;
            latestFieldActivity: string | null;
            latestSoilTestAt: string | null;
            needsAttention: boolean;
            openIssueCount: number;
            blockHealth: string | null;
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
        }[];
        timeline: import("../crm/farmer-team-timeline.service.js").TeamTimelineEntry[];
        ownership: import("./partner.types.js").FarmerOwnership | null;
        opportunityScore: number | null;
        pendingTaskCount: number;
        salesOpportunities: any[];
        recentVisits: {
            id: string;
            farmerId: string;
            blockId: string | null;
            visitedAt: string;
            summary: string;
        }[];
    }>;
    createSupportRequest(partnerId: string, farmerId: string, input: {
        requestType: string;
        notes: string;
    }, partnerName: string): Promise<{
        ok: boolean;
    }>;
    listPartnerFarmers: (partnerId: string, limit?: number) => Promise<{
        id: any;
        name: any;
        phone: any;
        village: any;
        district: any;
        service_model: any;
        created_at: any;
    }[]>;
};
//# sourceMappingURL=partner-mobile.service.d.ts.map