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
        visitIssueId: string | null;
        issueDetected: string | null;
        recommendationText: string;
        dosage: string | null;
        status: string;
        fieldRecStatus: string | null;
        priority: string | null;
        reviewDate: string | null;
        outcome: string | null;
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
    getCallLogSummary(farmerId: string): Promise<{
        totalCalls: number;
        lastCallAt: string | null;
        lastCallOutcome: string | null;
        lastCallAgent: string | null;
        lastCallSummary: string | null;
        connectedCount: number;
        pendingAiSummary: number;
        recentCalls: {
            id: string;
            outcome: string | null;
            at: string;
            agentEmail: string | null;
            durationSeconds: number | null;
            aiSummary: string | null;
            direction: string;
        }[];
    }>;
    listFarmerInteractions(farmerId: string, leadId?: string | null, page?: number, limit?: number): Promise<{
        interactions: {
            typeKey: string;
            typeIcon: string;
            typeCategory: string;
            displayStatus: string;
            statusTone: string;
            nextActionLabel: string | null;
            blockName: string | null;
            blockId: string | null;
            id: string;
            at: string;
            interactionType: string;
            summary: string;
            status: string;
            completionStatus: "pending" | "completed" | null;
            by: string;
            role: string;
            createdLabel: string;
            dueLabel: string | null;
            isDueToday: boolean;
            taskId: string | null;
            source: "call" | "recommendation" | "follow_up" | "visit" | "task" | "log" | "rec_record";
            canArchive: boolean;
            canEdit: boolean;
            nextAction?: string | null;
            nextActionAt?: string | null;
            fieldFinding?: string | null;
            fieldFindingId?: string | null;
            recommendationId?: string | null;
            escalationId?: string | null;
            fieldActivity?: string | null;
            activityDateLabel?: string | null;
            recommendation?: string | null;
            outcome?: string | null;
            workflowStatus?: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    getFarmerInteractionDetail(farmerId: string, interactionId: string, leadId?: string | null): Promise<{
        id: string;
        source: string;
        interactionType: string;
        summary: string;
        status: string;
        completionStatus?: "pending" | "completed" | null;
        canEdit?: boolean;
        taskId?: string | null;
        by: string;
        role: string;
        createdLabel: string;
        at: string;
        fields: Array<{
            label: string;
            value: string;
        }>;
        sections: Array<{
            title: string;
            content: string;
        }>;
        followUpTimeline: Array<{
            label: string;
            status: string;
            atLabel: string;
            detail?: string;
        }>;
        products: Array<{
            name: string;
            detail?: string;
        }>;
        operationalChain?: Awaited<ReturnType<(log: Record<string, unknown>) => Promise<{
            fieldFinding?: {
                id: string;
                issue: string;
                findingType?: string | null;
                severity?: string | null;
                affectedAreaPct?: number | null;
            };
            recommendation?: {
                id: string;
                summary: string;
                problem?: string | null;
                status?: string | null;
            };
            escalation?: {
                id: string;
                status: string;
                workflowStatus?: string | null;
            };
        } | undefined>>>;
        editForm?: {
            kind: "task" | "log";
            title?: string;
            notes?: string;
            dueAt?: string;
            summary?: string;
            content?: string;
        };
    } | {
        id: string;
        source: string;
        interactionType: string;
        summary: string;
        status: string;
        completionStatus: string;
        canEdit: boolean;
        taskId: string;
        by: string;
        role: string;
        createdLabel: string;
        at: string;
        fields: Array<{
            label: string;
            value: string;
        }>;
        sections: {
            title: string;
            content: string;
        }[];
        followUpTimeline: never[];
        products: never[];
        editForm: {
            kind: string;
            title: string;
            notes: string;
            dueAt: string;
            summary?: undefined;
            content?: undefined;
        };
        operationalChain?: undefined;
    } | {
        id: string;
        source: string;
        interactionType: string;
        summary: string;
        status: string;
        completionStatus: string;
        canEdit: boolean;
        taskId: null;
        by: string;
        role: string;
        createdLabel: string;
        at: string;
        fields: Array<{
            label: string;
            value: string;
        }>;
        sections: {
            title: string;
            content: string;
        }[];
        followUpTimeline: never[];
        products: never[];
        operationalChain: {
            fieldFinding?: {
                id: string;
                issue: string;
                findingType?: string | null;
                severity?: string | null;
                affectedAreaPct?: number | null;
            };
            recommendation?: {
                id: string;
                summary: string;
                problem?: string | null;
                status?: string | null;
            };
            escalation?: {
                id: string;
                status: string;
                workflowStatus?: string | null;
            };
        } | undefined;
        editForm: {
            kind: string;
            summary: string;
            content: string;
            title?: undefined;
            notes?: undefined;
            dueAt?: undefined;
        };
    }>;
    getWorkspaceDashboard(farmerId: string): Promise<{
        openIssuesCount: number;
        pendingRecommendationsCount: number;
        pendingFindingReviewsCount: number;
        pendingAiCasesCount: number;
        todaysVisitsCount: number;
        lastCallAt: string | null;
        farmerSummary: {
            name: string;
            lastCallAt: string | null;
            lastVisitAt: string | null;
            openIssuesCount: number;
            pendingRecommendationsCount: number;
        };
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
    listFarmerOrders(farmerId: string): Promise<{
        orders: import("../admin/telecaller-farmer-orders.service.js").TelecallerOrderRow[];
    }>;
    listWhatsAppHistory(farmerId: string, limit?: number): Promise<{
        id: string;
        summary: string;
        at: string;
        by: string | null;
        workflowStatus: string | null;
    }[]>;
    logFarmerCall(farmerId: string, agentEmail: string, input: {
        outcome?: string;
        notes?: string;
        durationSeconds?: number;
    }): Promise<{
        lead: {
            pincode: string | null;
            serviceModel: import("../partner/partner.types.js").ServiceModel;
            assignedPartnerId: string | null;
            assignedPartnerName: string | null;
            ownership: string | null;
            enrollmentSource: string | null;
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
            phone: {} | null;
            district: {} | null;
            state: {} | null;
            farmerStatus: string;
        };
        farmer: {
            id: string;
            name: string;
            phone: {} | null;
            email: null;
            district: {} | null;
            state: {} | null;
            pincode: string | null;
            village: string | null;
            language: {};
            territory: string;
            crop: string;
            acreage: string;
            whatsappSame: boolean;
            whatsappPhone: string | null;
            shippingAddress: string | null;
            deliveryPincode: string | null;
            roiEnabled: boolean;
            farmerNotes: string | null;
            assignedCropAdvisor: string | null;
            farmSize: string;
            irrigation: string;
            soilType: string;
            rating: number;
        };
        farmOverview: {
            totalBlocks: number;
            totalArea: {};
            primaryCrop: string;
            soilType: {};
            blocks: {
                id: string;
                name: string;
                cropType: string;
                acreage: any;
                isPrimary: boolean;
            }[];
        };
        soilReport: {
            reportId: {};
            date: {};
            health: {};
            ph: {};
        };
        tasks: {
            id: any;
            title: any;
            dueAt: any;
            dueLabel: string | null;
            status: any;
            type: any;
        }[];
        nextFollowUp: {
            id: any;
            title: any;
            dueLabel: string | null;
            notes: any;
        } | null;
        timeline: {
            id: string;
            type: string;
            title: string;
            detail: string;
            at: string;
            atLabel: string;
        }[];
        orders: {
            id: any;
            label: any;
            amount: number;
            date: string | null;
        }[];
        stages: {
            id: string;
            label: string;
            active: boolean;
            done: boolean;
        }[];
    }>;
    createFarmerReminder(farmerId: string, agentEmail: string, input: {
        reason: string;
        dueAt?: string;
        assignTo?: "agronomist" | "telecaller";
    }): Promise<any>;
    listFarmerVisits(farmerId: string, options?: {
        limit?: number;
        status?: "open" | "monitoring" | "resolved";
        blockId?: string;
    }): Promise<{
        id: string;
        blockId: string | null;
        blockName: string;
        cropType: string | null;
        visitedAt: string;
        dapAtVisit: number | null;
        issueCount: number;
        recommendationCount: number;
        summary: string;
        blockHealth: string | null;
        topIssueNames: string[];
    }[]>;
    listNotifications(agentEmail: string): Promise<{
        id: string;
        category: string;
        title: string;
        detail?: string | null;
        at: string;
        farmerId?: string;
    }[]>;
};
//# sourceMappingURL=agronomist-mobile.service.d.ts.map