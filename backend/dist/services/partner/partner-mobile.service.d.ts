import type { StructuredFieldVisitInput } from '../../domain/ai-training/validators.js';
export declare const partnerMobileService: {
    getDashboard(partnerId: string): Promise<{
        activeFarmers: number;
        pendingTasks: number;
        visitsThisMonth: number;
        routesToday: number;
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
            index: number;
        }[];
        recommendationIds: string[];
    }>;
    rejectTask(taskId: string, partnerId: string, reason: string): Promise<any>;
    rescheduleTask(taskId: string, partnerId: string, dueAt: string): Promise<any>;
    listVisits(partnerId: string, limit?: number): Promise<{
        id: string;
        farmerId: string;
        farmerName: string | undefined;
        blockId: string | null;
        visitedAt: string;
        summary: string | undefined;
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
    saveBlockLocation(input: {
        blockId: string;
        farmerId: string;
        latitude: number;
        longitude: number;
    }): Promise<import("../core/block.service.js").BlockWithDap>;
    assertFarmerAccess(partnerId: string, farmerId: string): Promise<void>;
    getFarmerWorkspace(partnerId: string, farmerId: string): Promise<{
        farmer: import("./partner-farmer-workspace.service.js").PartnerFarmerHeader;
        header: import("./partner-farmer-workspace.service.js").PartnerFarmerHeader;
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
        ownership: {
            enrollmentOwnerPartnerName: string | null;
            customerOwnerPartnerName: string | null;
            assignedPartnerName: string | null;
            assignedExpertEmail: string | null;
            enrollmentOwnerType: import("./partner.types.js").EnrollmentOwnerType | null;
            enrollmentOwnerPartnerId: string | null;
            enrollmentSource: string | null;
            enrollmentEventId: string | null;
            customerOwnerType: import("./partner.types.js").CustomerOwnerType | null;
            customerOwnerPartnerId: string | null;
            serviceModel: import("./partner.types.js").ServiceModel | null;
            assignedPartnerId: string | null;
            assignedTelecallerEmail: string | null;
            partnerCodeAtEnrollment: string | null;
        } | null;
        farmSnapshot: import("./partner-farmer-workspace.service.js").PartnerFarmSnapshot;
        currentRecommendation: import("./partner-farmer-workspace.service.js").PartnerCurrentRecommendation;
        suggestedAction: import("./partner-farmer-workspace.service.js").PartnerSuggestedAction;
        suggestedActionLabel: string;
        pendingTaskCount: number;
        openRecommendationsCount: number;
        lastVisitAt: string | null;
        salesOpportunities: any[];
        recentVisits: {
            id: string;
            farmerId: string;
            blockId: string | null;
            visitedAt: string;
            summary: string;
            status: string;
        }[];
    }>;
    createSupportRequest(partnerId: string, farmerId: string, input: {
        requestType: string;
        notes: string;
    }, partnerName: string): Promise<{
        ok: boolean;
    }>;
    listPartnerFarmers: (partnerId: string, limit?: number) => Promise<import("./partner-farmer-workspace.service.js").PartnerFarmerListRow[]>;
};
//# sourceMappingURL=partner-mobile.service.d.ts.map