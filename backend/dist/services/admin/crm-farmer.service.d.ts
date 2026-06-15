import type { FindingType, ReviewSeverity } from '../../domain/ai-training/enums.js';
export type MasterType = 'crop' | 'market' | 'variety' | 'irrigation_type' | 'soil_type' | 'growth_stage' | 'block_status' | 'disease' | 'pest' | 'interaction_type' | 'interaction_outcome' | 'interaction_next_action' | 'recommendation_type' | 'application_method' | 'payment_mode' | 'priority' | 'visit_type' | 'moisture_status' | 'pest_pressure' | 'plant_condition' | 'delivery_partner' | 'manual_courier' | 'territory' | 'specialization' | 'brand' | 'product_category' | 'product_sub_category' | 'formulation_type' | 'mode_of_entry' | 'product_type' | 'shelf_life' | 'storage_condition' | 'packing_type' | 'pack_material' | 'application_stage' | 'product_unit' | 'language';
export declare const crmFarmerService: {
    listMasters(type: MasterType, parentId?: string | null, search?: string): Promise<{
        id: any;
        master_type: any;
        name: any;
        parent_id: any;
        category: any;
        description: any;
        active: any;
        sort_order: any;
    }[]>;
    seedDefaultMasters(type: MasterType, names: string[], rows: Array<{
        name: string;
    }>): Promise<boolean>;
    createMaster(input: {
        masterType: MasterType;
        name: string;
        parentId?: string | null;
        category?: string;
        description?: string;
    }): Promise<any>;
    seedMarketMastersFromPrices(rows: Array<{
        id: string;
        master_type: string;
        name: string;
        parent_id: string | null;
        category: string | null;
        description: string | null;
        active: boolean;
        sort_order: number | null;
    }>): Promise<{
        id: any;
        master_type: any;
        name: any;
        parent_id: any;
        category: any;
        description: any;
        active: any;
        sort_order: any;
    }[]>;
    updateMaster(id: string, patch: {
        name?: string;
        active?: boolean;
        description?: string;
        category?: string | null;
    }): Promise<any>;
    listBlocks(farmerId: string): Promise<{
        id: unknown;
        farmerId: unknown;
        name: unknown;
        area: {};
        cropName: {};
        varietyName: {};
        cropId: unknown;
        varietyId: unknown;
        irrigationTypeId: unknown;
        soilTypeId: unknown;
        growthStageId: unknown;
        growthStageName: string;
        irrigationTypeName: string;
        plantingDate: string | null;
        spacing: unknown;
        soilHealth: string;
        soilTone: string;
        lastVisit: string;
        growthPercent: {};
        status: string;
        latitude: number | null;
        longitude: number | null;
        locationCapturedAt: string | null;
        locationSource: string | null;
    }[]>;
    getBlock(blockId: string): Promise<{
        id: unknown;
        farmerId: unknown;
        name: unknown;
        area: {};
        cropName: {};
        varietyName: {};
        cropId: unknown;
        varietyId: unknown;
        irrigationTypeId: unknown;
        soilTypeId: unknown;
        growthStageId: unknown;
        growthStageName: string;
        irrigationTypeName: string;
        plantingDate: string | null;
        spacing: unknown;
        soilHealth: string;
        soilTone: string;
        lastVisit: string;
        growthPercent: {};
        status: string;
        latitude: number | null;
        longitude: number | null;
        locationCapturedAt: string | null;
        locationSource: string | null;
    }>;
    createBlock(farmerId: string, input: {
        name: string;
        area?: string;
        cropId?: string;
        cropName?: string;
        varietyId?: string;
        varietyName?: string;
        irrigationTypeId?: string;
        soilTypeId?: string;
        plantingDate?: string;
        spacing?: string;
    }): Promise<{
        id: unknown;
        farmerId: unknown;
        name: unknown;
        area: {};
        cropName: {};
        varietyName: {};
        cropId: unknown;
        varietyId: unknown;
        irrigationTypeId: unknown;
        soilTypeId: unknown;
        growthStageId: unknown;
        growthStageName: string;
        irrigationTypeName: string;
        plantingDate: string | null;
        spacing: unknown;
        soilHealth: string;
        soilTone: string;
        lastVisit: string;
        growthPercent: {};
        status: string;
        latitude: number | null;
        longitude: number | null;
        locationCapturedAt: string | null;
        locationSource: string | null;
    }>;
    updateBlock(blockId: string, patch: Record<string, unknown>): Promise<{
        id: unknown;
        farmerId: unknown;
        name: unknown;
        area: {};
        cropName: {};
        varietyName: {};
        cropId: unknown;
        varietyId: unknown;
        irrigationTypeId: unknown;
        soilTypeId: unknown;
        growthStageId: unknown;
        growthStageName: string;
        irrigationTypeName: string;
        plantingDate: string | null;
        spacing: unknown;
        soilHealth: string;
        soilTone: string;
        lastVisit: string;
        growthPercent: {};
        status: string;
        latitude: number | null;
        longitude: number | null;
        locationCapturedAt: string | null;
        locationSource: string | null;
    }>;
    getBlockWorkspace(farmerId: string, blockId: string): Promise<{
        block: {
            id: unknown;
            farmerId: unknown;
            name: unknown;
            area: {};
            cropName: {};
            varietyName: {};
            cropId: unknown;
            varietyId: unknown;
            irrigationTypeId: unknown;
            soilTypeId: unknown;
            growthStageId: unknown;
            growthStageName: string;
            irrigationTypeName: string;
            plantingDate: string | null;
            spacing: unknown;
            soilHealth: string;
            soilTone: string;
            lastVisit: string;
            growthPercent: {};
            status: string;
            latitude: number | null;
            longitude: number | null;
            locationCapturedAt: string | null;
            locationSource: string | null;
        };
        soilReports: {
            id: any;
            reportedLabel: string | null;
            metrics: import("../soil/soil-lab-metrics.js").SoilLabMetrics;
            pdfUrl: any;
        }[];
        visits: {
            id: string | undefined;
            agronomistName: unknown;
            diseasePest: unknown;
            observations: unknown;
            parameters: {
                label: string;
                value: string;
            }[];
            visitedLabel: string | null;
            spad: string | undefined;
            shootCount: string | undefined;
            leafCount: string | undefined;
            moisture: string | undefined;
            pestPressure: string | undefined;
            photoUrls: string[];
        }[];
        blockRecommendations: {
            id: unknown;
            recId: string;
            dateLabel: string | null;
            blockName: string;
            cropType: string;
            problem: unknown;
            recommendation: unknown;
            products: unknown;
            dosage: unknown;
            applicationMethod: unknown;
            recommendedBy: {};
            status: unknown;
            statusTone: string;
            followUpLabel: string | null;
            recType: unknown;
        }[];
        followUps: {
            id: any;
            title: any;
            dueLabel: string | null;
            taskType: any;
            notes: any;
        }[];
        blockInfo: {
            blockName: unknown;
            area: {};
            crop: {};
            variety: {};
            plantingDate: string | null;
            daysAfterPlanting: number | null;
            irrigationType: string;
            spacing: unknown;
            growthStage: string;
            growthPercent: {};
            nextStage: string;
            latitude: number | null;
            longitude: number | null;
            locationCapturedAt: string | null;
            locationSource: string | null;
            hasPlotGps: boolean;
        };
        soilReport: {
            metrics: import("../soil/soil-lab-metrics.js").SoilLabMetrics;
            pdfUrl: any;
            reportedLabel: string | null;
        };
        latestVisit: {
            id: string | undefined;
            agronomistName: unknown;
            diseasePest: unknown;
            observations: unknown;
            parameters: {
                label: string;
                value: string;
            }[];
            visitedLabel: string | null;
            spad: string | undefined;
            shootCount: string | undefined;
            leafCount: string | undefined;
            moisture: string | undefined;
            pestPressure: string | undefined;
            photoUrls: string[];
        } | null;
        recommendations: {
            id: unknown;
            recId: string;
            dateLabel: string | null;
            blockName: string;
            cropType: string;
            problem: unknown;
            recommendation: unknown;
            products: unknown;
            dosage: unknown;
            applicationMethod: unknown;
            recommendedBy: {};
            status: unknown;
            statusTone: string;
            followUpLabel: string | null;
            recType: unknown;
        }[];
        nextFollowUp: {
            title: string;
            dueLabel: string;
            notes: string | undefined;
        } | null;
        applicationTracking: {
            recommendationId: string;
            issueDetected: string;
            recommendedText: string;
            recommendedTechnicalName: string;
            differentProduct: boolean;
            partialApply: boolean;
            applicationStatus: string | null;
            outcome: string | null;
            appliedTechnicalName: string | null;
            appliedTradeName: string | null;
            resultStatus: string | null;
            appliedAt: string | null;
        }[];
        timeline: {
            title: string;
            atLabel: string;
            at: string;
            kind?: string;
            detail?: string;
        }[];
    }>;
    blockTimeline(farmerId: string, blockId: string): Promise<{
        title: string;
        atLabel: string;
        at: string;
        kind?: string;
        detail?: string;
    }[]>;
    listSoilReports(farmerId: string, blockId?: string): Promise<any[]>;
    createSoilReport(farmerId: string, input: {
        blockId?: string;
        metrics?: Record<string, unknown>;
        pdfUrl?: string;
        uploadedBy?: string;
        reportedAt?: string;
    }): Promise<any>;
    listRecommendations(farmerId: string, page?: number, limit?: number): Promise<{
        recommendations: {
            id: unknown;
            recId: string;
            dateLabel: string | null;
            blockName: string;
            cropType: string;
            problem: unknown;
            recommendation: unknown;
            products: unknown;
            dosage: unknown;
            applicationMethod: unknown;
            recommendedBy: {};
            status: unknown;
            statusTone: string;
            followUpLabel: string | null;
            recType: unknown;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    createRecommendation(farmerId: string, leadId: string | null, input: {
        blockId?: string;
        recType?: string;
        problem?: string;
        recommendation: string;
        products?: unknown[];
        dosage?: string;
        applicationMethod?: string;
        followUpAt?: string;
        recommendedBy?: string;
    }): Promise<{
        id: unknown;
        recId: string;
        dateLabel: string | null;
        blockName: string;
        cropType: string;
        problem: unknown;
        recommendation: unknown;
        products: unknown;
        dosage: unknown;
        applicationMethod: unknown;
        recommendedBy: {};
        status: unknown;
        statusTone: string;
        followUpLabel: string | null;
        recType: unknown;
    }>;
    listInteractions(farmerId: string, page?: number, limit?: number): Promise<{
        interactions: {
            id: unknown;
            atLabel: string | null;
            type: string;
            typeLabel: string;
            icon: string;
            by: {};
            role: {};
            summary: {};
            nextAction: {};
            nextDate: string;
            status: string;
            statusTone: string;
            block: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    /** Telecaller CRM tab — operational workflow sessions only (no merged micro-events). */
    listHumanCrmInteractions(farmerId: string, leadId: string | null, page?: number, limit?: number): Promise<{
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
            source: InteractionSource;
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
    /** Full detail for one timeline row (id encodes source — see listHumanCrmInteractions). */
    getHumanCrmInteractionDetail(farmerId: string, _leadId: string | null, interactionId: string): Promise<{
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
        operationalChain?: Awaited<ReturnType<typeof loadOperationalChain>>;
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
    createInteraction(farmerId: string, leadId: string | null, input: {
        interactionType: string;
        channel?: string;
        blockId?: string;
        summary?: string;
        notes?: string;
        interactionAt?: string;
        outcome?: string;
        nextAction?: string;
        nextActionAt?: string;
        workflowStatus?: string;
        fieldFindingText?: string;
        addFieldFinding?: boolean;
        findingType?: FindingType;
        severity?: ReviewSeverity;
        affectedAreaPct?: number;
        finalConfirmedIssue?: string;
        aiPrediction?: string;
        observations?: string;
        fieldActivityLabel?: string;
        fieldActivityTypeId?: string;
        fieldActivityDate?: string;
        addFieldActivity?: boolean;
        recommendationSummary?: string;
        recommendationCompleted?: boolean;
        escalate?: boolean;
        status?: string;
        doneBy?: string;
        doneByRole?: string;
    }): Promise<{
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
        source: InteractionSource;
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
    }>;
    getAgronomist(farmerId: string): Promise<AgronomistProfile>;
    upsertAgronomist(farmerId: string, input: Partial<{
        agronomistName: string;
        employeeId: string;
        mobile: string;
        email: string;
        specialization: string;
        nextVisitAt: string;
    }>): Promise<AgronomistProfile>;
    ensureDemoCrmData(farmerId: string, leadId: string | null, agentEmail?: string): Promise<{
        id: unknown;
        farmerId: unknown;
        name: unknown;
        area: {};
        cropName: {};
        varietyName: {};
        cropId: unknown;
        varietyId: unknown;
        irrigationTypeId: unknown;
        soilTypeId: unknown;
        growthStageId: unknown;
        growthStageName: string;
        irrigationTypeName: string;
        plantingDate: string | null;
        spacing: unknown;
        soilHealth: string;
        soilTone: string;
        lastVisit: string;
        growthPercent: {};
        status: string;
        latitude: number | null;
        longitude: number | null;
        locationCapturedAt: string | null;
        locationSource: string | null;
    }[]>;
    getFarmerCrmBundle(farmerId: string, leadId: string | null, agentEmail?: string): Promise<{
        blocks: {
            id: unknown;
            farmerId: unknown;
            name: unknown;
            area: {};
            cropName: {};
            varietyName: {};
            cropId: unknown;
            varietyId: unknown;
            irrigationTypeId: unknown;
            soilTypeId: unknown;
            growthStageId: unknown;
            growthStageName: string;
            irrigationTypeName: string;
            plantingDate: string | null;
            spacing: unknown;
            soilHealth: string;
            soilTone: string;
            lastVisit: string;
            growthPercent: {};
            status: string;
            latitude: number | null;
            longitude: number | null;
            locationCapturedAt: string | null;
            locationSource: string | null;
        }[];
        agronomist: AgronomistProfile;
        interactions: {
            interactions: {
                id: unknown;
                atLabel: string | null;
                type: string;
                typeLabel: string;
                icon: string;
                by: {};
                role: {};
                summary: {};
                nextAction: {};
                nextDate: string;
                status: string;
                statusTone: string;
                block: string;
            }[];
            pagination: {
                page: number;
                limit: number;
                total: number;
                pages: number;
            };
        };
        recommendations: {
            recommendations: {
                id: unknown;
                recId: string;
                dateLabel: string | null;
                blockName: string;
                cropType: string;
                problem: unknown;
                recommendation: unknown;
                products: unknown;
                dosage: unknown;
                applicationMethod: unknown;
                recommendedBy: {};
                status: unknown;
                statusTone: string;
                followUpLabel: string | null;
                recType: unknown;
            }[];
            pagination: {
                page: number;
                limit: number;
                total: number;
                pages: number;
            };
        };
        orders: {
            orders: import("./telecaller-farmer-orders.service.js").TelecallerOrderRow[];
        };
        internalNotes: {
            id: unknown;
            farmerId: unknown;
            author: unknown;
            category: unknown;
            body: unknown;
            pinned: unknown;
            archivedAt: unknown;
            createdAt: unknown;
            updatedAt: unknown;
        }[];
        ownership: import("../partner/partner.types.js").FarmerOwnership | null;
    }>;
    listFarmerOrders(farmerId: string): Promise<{
        orders: import("./telecaller-farmer-orders.service.js").TelecallerOrderRow[];
    }>;
    getFarmerOrderDetail(farmerId: string, orderId: string): Promise<import("./telecaller-farmer-orders.service.js").TelecallerOrderRow>;
    ensureDemoBlocks(farmerId: string): Promise<{
        id: unknown;
        farmerId: unknown;
        name: unknown;
        area: {};
        cropName: {};
        varietyName: {};
        cropId: unknown;
        varietyId: unknown;
        irrigationTypeId: unknown;
        soilTypeId: unknown;
        growthStageId: unknown;
        growthStageName: string;
        irrigationTypeName: string;
        plantingDate: string | null;
        spacing: unknown;
        soilHealth: string;
        soilTone: string;
        lastVisit: string;
        growthPercent: {};
        status: string;
        latitude: number | null;
        longitude: number | null;
        locationCapturedAt: string | null;
        locationSource: string | null;
    }[]>;
    listInteractionsFiltered(farmerId: string, filters: {
        type?: string;
        status?: string;
        blockId?: string;
    }, page?: number, limit?: number): Promise<{
        interactions: {
            id: unknown;
            atLabel: string | null;
            type: string;
            typeLabel: string;
            icon: string;
            by: {};
            role: {};
            summary: {};
            nextAction: {};
            nextDate: string;
            status: string;
            statusTone: string;
            block: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    updateInteraction(id: string, patch: Record<string, unknown>): Promise<{
        id: unknown;
        atLabel: string | null;
        type: string;
        typeLabel: string;
        icon: string;
        by: {};
        role: {};
        summary: {};
        nextAction: {};
        nextDate: string;
        status: string;
        statusTone: string;
        block: string;
    }>;
    archiveInteraction(id: string): Promise<{
        id: unknown;
        atLabel: string | null;
        type: string;
        typeLabel: string;
        icon: string;
        by: {};
        role: {};
        summary: {};
        nextAction: {};
        nextDate: string;
        status: string;
        statusTone: string;
        block: string;
    }>;
    updateRecommendation(id: string, patch: Record<string, unknown>): Promise<{
        id: unknown;
        recId: string;
        dateLabel: string | null;
        blockName: string;
        cropType: string;
        problem: unknown;
        recommendation: unknown;
        products: unknown;
        dosage: unknown;
        applicationMethod: unknown;
        recommendedBy: {};
        status: unknown;
        statusTone: string;
        followUpLabel: string | null;
        recType: unknown;
    }>;
    archiveRecommendation(id: string): Promise<{
        id: unknown;
        recId: string;
        dateLabel: string | null;
        blockName: string;
        cropType: string;
        problem: unknown;
        recommendation: unknown;
        products: unknown;
        dosage: unknown;
        applicationMethod: unknown;
        recommendedBy: {};
        status: unknown;
        statusTone: string;
        followUpLabel: string | null;
        recType: unknown;
    }>;
    listFieldFindingsForBlock(farmerId: string, blockId: string, limit?: number): Promise<{
        id: string | undefined;
        agronomistName: unknown;
        diseasePest: unknown;
        observations: unknown;
        parameters: {
            label: string;
            value: string;
        }[];
        visitedLabel: string | null;
        spad: string | undefined;
        shootCount: string | undefined;
        leafCount: string | undefined;
        moisture: string | undefined;
        pestPressure: string | undefined;
        photoUrls: string[];
    }[]>;
    archiveFieldFinding(id: string): Promise<{
        ok: boolean;
    }>;
    listRecommendationsForBlock(farmerId: string, blockId: string): Promise<{
        id: unknown;
        recId: string;
        dateLabel: string | null;
        blockName: string;
        cropType: string;
        problem: unknown;
        recommendation: unknown;
        products: unknown;
        dosage: unknown;
        applicationMethod: unknown;
        recommendedBy: {};
        status: unknown;
        statusTone: string;
        followUpLabel: string | null;
        recType: unknown;
    }[]>;
    listBlockFollowUps(farmerId: string, blockId?: string): Promise<{
        id: any;
        title: any;
        dueLabel: string | null;
        taskType: any;
        notes: any;
    }[]>;
    resolveAgronomistEmail(farmerId: string): Promise<string | null>;
    scheduleVisit(farmerId: string, leadId: string | null, input: {
        title?: string;
        dueAt: string;
        notes?: string;
        blockId?: string;
        assignedTo?: string;
        assignedAgronomist?: string;
        createdBy?: string;
    }): Promise<{
        task: any;
        icsContent: string;
        icsFilename: string;
        assignedAgronomist: string | null;
    }>;
    createManualOrder(farmerId: string, leadId: string | null, input: {
        blockId?: string;
        recommendationId?: string;
        lineItems: {
            variantId?: number;
            title: string;
            quantity: number;
            price: number;
        }[];
        paymentMode?: string;
        deliveryAddress?: string;
        notes?: string;
        createdBy?: string;
    }): Promise<import("./telecaller-farmer-orders.service.js").TelecallerOrderRow>;
    convertRecommendationToOrder(recommendationId: string, farmerId: string, leadId: string | null, createdBy?: string): Promise<import("./telecaller-farmer-orders.service.js").TelecallerOrderRow>;
    listManualOrders(farmerId: string): Promise<{
        id: unknown;
        orderRef: unknown;
        dateLabel: string | null;
        product: string;
        qty: number;
        amount: number;
        status: string;
        statusTone: string;
        payment: string;
        deliveryDate: string;
        deliveryBy: string;
        block: string;
        source: string;
    }[]>;
    getOrderCatalog(search?: string): Promise<{
        productId: number | undefined;
        variantId: number | undefined;
        title: string;
        sku: string;
        price: number;
        stock: number;
    }[]>;
    buildExportHtml(_type: string, payload: Record<string, unknown>): string;
    buildWhatsAppMessage(type: string, payload: Record<string, unknown>, phone?: string): {
        text: string;
        url: string | null;
    };
};
type InteractionSource = 'log' | 'call' | 'task' | 'recommendation' | 'visit' | 'follow_up' | 'rec_record';
declare function loadOperationalChain(log: Record<string, unknown>): Promise<{
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
} | undefined>;
type AgronomistProfile = {
    name: unknown;
    employeeId: unknown;
    mobile: string;
    email: string;
    specialization: unknown;
    assignedSince: unknown;
    assignedBlocks: string;
    lastReview: string | null;
    nextVisit: string;
    activities: {
        date: string;
        activity: string;
        activityTone: string;
        block: string;
        notes: string;
    }[];
    blocks: {
        block: string;
        crop: string;
        area: string;
        status: string;
        statusTone: string;
    }[];
    performance: {
        label: string;
        value: string;
        icon: string;
    }[];
    farmerId: string;
};
export {};
//# sourceMappingURL=crm-farmer.service.d.ts.map