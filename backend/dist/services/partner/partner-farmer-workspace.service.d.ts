export type PartnerSuggestedAction = 'field_visit' | 'follow_up' | 'soil_sampling' | 'callback' | 'none';
export type PartnerFarmSnapshot = {
    totalAcreage: number | null;
    activeBlockCount: number;
    primaryCrop: string | null;
    cropStatus: string | null;
};
export type PartnerCurrentRecommendation = {
    id: string;
    title: string;
    status: string;
} | null;
export type PartnerFarmerHeader = {
    id: string;
    name: string;
    phone: string | null;
    village: string | null;
    district: string | null;
    primaryCrop: string | null;
    totalAcreage: number | null;
    customerOwnerType: string | null;
    assignedTelecallerEmail: string | null;
    serviceModel: string | null;
    latitude: number | null;
    longitude: number | null;
};
export type PartnerFarmerListRow = {
    id: string;
    name: string;
    phone: string | null;
    village: string | null;
    district: string | null;
    primaryCrop: string | null;
    totalAcreage: number | null;
    lastOrderDate: string | null;
    suggestedAction: PartnerSuggestedAction;
    suggestedActionLabel: string;
};
export declare function computeSuggestedAction(input: {
    pendingPartnerTasks: number;
    daysSinceLastVisit: number | null;
    openIssueCount: number;
    hasSoilTask: boolean;
}): PartnerSuggestedAction;
export declare const partnerFarmerWorkspaceService: {
    suggestedActionLabel(action: PartnerSuggestedAction): string;
    getLastOrderDate(farmerId: string): Promise<string | null>;
    listPartnerFarmers(partnerId: string, limit?: number): Promise<PartnerFarmerListRow[]>;
    buildWorkspace(partnerId: string, farmerId: string): Promise<{
        farmer: PartnerFarmerHeader;
        header: PartnerFarmerHeader;
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
        farmSnapshot: PartnerFarmSnapshot;
        currentRecommendation: PartnerCurrentRecommendation;
        suggestedAction: PartnerSuggestedAction;
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
    listFarmerTasks(partnerId: string, farmerId: string): Promise<{
        id: string;
        title: string;
        taskType: string;
        taskCategory: string;
        dueAt: string | null;
        status: string;
        farmerId: string;
        blockId: string | null;
        priority: string;
        notes: string | null;
    }[]>;
    listFarmerOrders(farmerId: string): Promise<{
        id: string;
        orderDate: string;
        products: string;
        quantity: number;
        deliveryStatus: string;
    }[]>;
    listFarmerEscalations(farmerId: string): Promise<{
        id: string;
        body: string;
        entryType: string;
        status: string;
        createdAt: string;
    }[]>;
    createEscalation(partnerId: string, farmerId: string, input: {
        category: string;
        notes: string;
    }, partnerName: string): Promise<any>;
    scheduleCallback(partnerId: string, farmerId: string, notes: string, partnerName: string): Promise<any>;
    listVisitSessions(partnerId: string, farmerId: string): Promise<{
        id: string;
        farmerId: string;
        blockId: string | null;
        status: string;
        checkInAt: string;
        checkOutAt: string | null;
        durationMinutes: number | null;
    }[]>;
    getBlockDetail(farmerId: string, blockId: string): Promise<{
        activities: {
            [x: string]: unknown;
        }[];
        block: {
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
        };
        farmContext: {
            farmerPhone: string | null;
            village: string | null;
            district: string | null;
            acreage: number | null;
            area: string | null;
            irrigationType: string | null;
            varietyName: string | null;
            plantingDate: string | null;
            expectedHarvestDate: string | null;
            recentVisits: {
                id: string;
                dateLabel: string;
                summary: string;
                agronomistName: string | null;
            }[];
            recentRecommendations: {
                id: string;
                title: string;
                dateLabel: string;
                status: string;
            }[];
            recentApplications: {
                id: string;
                label: string;
                dateLabel: string;
                activityType: string;
            }[];
        };
        soilReports: {
            id: string;
            blockId: string;
            blockName: string;
            dateLabel: string;
            dapLabel: null;
            health: string;
            healthLabel: string;
            pdfUrl: string | null;
            highlights: string[];
            metrics: {
                label: string;
                value: string;
            }[];
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
            issueCount: number;
            recommendationCount: number;
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
    getBlockTimeline(farmerId: string, blockId: string): Promise<{
        title: string;
        atLabel: string;
        at: string;
        kind?: string;
        detail?: string;
    }[]>;
    listFarmerRecommendations(farmerId: string): Promise<{
        id: string;
        blockId: string | null;
        recommendationText: string;
        status: string;
        createdAt: string;
    }[]>;
    getInteractions(farmerId: string): Promise<import("../crm/farmer-team-timeline.service.js").TeamTimelineEntry[]>;
    addTeamComment(partnerId: string, farmerId: string, body: string, partnerName: string): Promise<any>;
};
//# sourceMappingURL=partner-farmer-workspace.service.d.ts.map