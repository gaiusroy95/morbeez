import type { RoiEntryType } from '../admin/farmer-roi-admin.service.js';
import type { AdvisoryLanguage } from '../ai/types.js';
export declare const farmerPortalMobileService: {
    listBlocks(farmerId: string): Promise<{
        blocks: {
            id: string;
            name: string;
            crop: string;
            acreage: number | null;
            dap: number;
            plantingDate: string | null;
            plantingDateLabel: string | null;
            healthStatus: "critical" | "stable" | "monitor" | "alert";
            healthLabel: string;
            lastActivity: string | null;
            currentAlert: string | null;
            stage: string;
            isPrimary: boolean;
        }[];
    }>;
    createBlock(farmerId: string, input: {
        name: string;
        cropType: string;
        acreage?: number;
        plantingDate?: string;
        irrigationType?: string;
    }): Promise<{
        id: string;
        name: string;
        crop: string;
        acreage: number | null;
        dap: number;
        healthStatus: "critical" | "stable" | "monitor" | "alert";
        healthLabel: string;
        lastActivity: null;
        currentAlert: null;
        stage: string;
        isPrimary: boolean;
    }>;
    updateBlock(farmerId: string, blockId: string, input: {
        name?: string;
        cropType?: string;
        acreage?: number;
        plantingDate?: string;
        irrigationType?: string;
    }): Promise<{
        id: string;
        name: string;
        crop: string;
        acreage: number | null;
        dap: number;
        healthStatus: "critical" | "stable" | "monitor" | "alert";
        healthLabel: string;
        lastActivity: null;
        currentAlert: null;
        stage: string;
        isPrimary: boolean;
    }>;
    getBlockDetail(farmerId: string, blockId: string): Promise<{
        block: {
            id: string;
            name: string;
            crop: string;
            acreage: number | null;
            dap: number;
            plantingDate: string | null;
            plantingDateLabel: string | null;
            healthStatus: "critical" | "stable" | "monitor" | "alert";
            healthLabel: string;
            lastActivity: string;
            currentAlert: string | null;
            stage: string;
            isPrimary: boolean;
            spad: string | null;
            shootCount: null;
            soilMoisture: string | null;
            irrigationType: string | null;
            healthScore: number;
        };
        timeline: {
            id: string;
            type: "recommendation" | "activity" | "scan" | "recovery" | "soil";
            title: string;
            subtitle: string | null;
            at: string;
            atLabel: string;
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
    getBlockTimeline(farmerId: string, blockId: string): Promise<{
        id: string;
        type: "recommendation" | "activity" | "scan" | "recovery" | "soil";
        title: string;
        subtitle: string | null;
        at: string;
        atLabel: string;
    }[]>;
    runScan(farmerId: string, input: {
        blockId?: string;
        scanType: "leaf" | "field" | "rhizome";
        imageData: string;
        mimeType?: string;
        language?: AdvisoryLanguage;
    }): Promise<{
        sessionId: string;
        detectedIssue: string;
        confidence: number;
        severity: "low" | "high" | "medium";
        spreadRisk: string | null;
        description: string;
        escalated: boolean;
        recommendationId: string | null;
        summary: string;
    }>;
    getScan(sessionId: string, farmerId: string): Promise<{
        sessionId: string;
        detectedIssue: string;
        confidence: number;
        severity: "low" | "high" | "medium";
        spreadRisk: string | null;
        description: string;
        escalated: boolean;
        recommendationId: string | null;
        summary: string;
    }>;
    listScans(farmerId: string, query: {
        blockId?: string;
        limit?: number;
    }): Promise<{
        sessionId: string;
        blockId: string | null;
        status: string;
        detectedIssue: string;
        summary: string | null;
        createdAt: string;
        dateLabel: string;
    }[]>;
    listRecommendations(farmerId: string): Promise<{
        recommendations: {
            id: string;
            kind: "product" | "technical";
            title: string;
            blockName: string | null;
            cropName: string;
            dateLabel: string;
            bullets: string[];
            dosage: string | null;
            waterRequirement: string | null;
            applicationTiming: string | null;
            followUpDate: string | null;
            expectedRecoveryDays: number | null;
            applicationMethod: string | null;
            status: string;
            products: {
                title: string;
                quantity?: number;
                variantId?: string | null;
                shopifyHandle?: string | null;
            }[];
            appliedAt: string | null;
        }[];
    }>;
    mapRecommendation(r: Record<string, unknown>): {
        id: string;
        kind: "product" | "technical";
        title: string;
        blockName: string | null;
        cropName: string;
        dateLabel: string;
        bullets: string[];
        dosage: string | null;
        waterRequirement: string | null;
        applicationTiming: string | null;
        followUpDate: string | null;
        expectedRecoveryDays: number | null;
        applicationMethod: string | null;
        status: string;
        products: {
            title: string;
            quantity?: number;
            variantId?: string | null;
            shopifyHandle?: string | null;
        }[];
        appliedAt: string | null;
    };
    getRecommendation(farmerId: string, id: string): Promise<{
        applicationSteps: string[];
        recoveryTimeline: string | null;
        id: string;
        kind: "product" | "technical";
        title: string;
        blockName: string | null;
        cropName: string;
        dateLabel: string;
        bullets: string[];
        dosage: string | null;
        waterRequirement: string | null;
        applicationTiming: string | null;
        followUpDate: string | null;
        expectedRecoveryDays: number | null;
        applicationMethod: string | null;
        status: string;
        products: {
            title: string;
            quantity?: number;
            variantId?: string | null;
            shopifyHandle?: string | null;
        }[];
        appliedAt: string | null;
    }>;
    markRecommendationApplied(farmerId: string, id: string): Promise<{
        ok: boolean;
    }>;
    listActivities(farmerId: string, query: {
        blockId?: string;
        type?: string;
        from?: string;
        to?: string;
    }): Promise<{
        activities: {
            id: string;
            blockId: string;
            blockName: string | null;
            activityType: string;
            activityLabel: string;
            activityDate: string;
            dateLabel: string;
            costInr: number | null;
            status: string;
            notes: string | null;
        }[];
    }>;
    createActivity(farmerId: string, input: {
        blockId: string;
        activityType: "spray_applied" | "fertigation" | "drench" | "scouting" | "irrigation" | "other";
        activityTypeId?: string;
        activityDate: string;
        productUsed?: string;
        quantity?: string;
        notes?: string;
        costInr?: number;
    }): Promise<{
        activities: {
            id: string;
            blockId: string;
            blockName: string | null;
            activityType: string;
            activityLabel: string;
            activityDate: string;
            dateLabel: string;
            costInr: number | null;
            status: string;
            notes: string | null;
        }[];
    }>;
    createRoiEntry(farmerId: string, input: {
        entryType: RoiEntryType;
        amount: number;
        entryDate: string;
        comments?: string;
    }): Promise<{
        id: string;
    }>;
    getWeather(farmerId: string, blockId?: string): Promise<{
        blockId: string | null;
        locationLabel: string | null;
        rainfallMm: number | null;
        rainfallForecastMm: number | null;
        humidityPct: number | null;
        temperatureC: number | null;
        diseaseRiskScore: number | null;
        diseaseAlerts: string[];
        summary: string;
    }>;
    getMarketPrices(farmerId: string, crop?: string): Promise<{
        crop: string;
        date: string;
        rows: {
            marketName: string;
            pricePerKg: number;
            lastYearPricePerKg: number | null;
            trend: "flat" | "up" | "down" | null;
        }[];
        summary: string;
    }>;
    getRoiDashboard(farmerId: string): Promise<{
        seasonId: string;
        blockName: string;
        dap: number;
        stageLabel: string;
        investmentInr: number;
        projectedRevenueInr: number;
        profitInr: number;
        spentInr: number;
        expectedIncomeInr: number;
        netProfitInr: number;
        roiPercent: number;
        yieldForecast: string | null;
        acreage: number | null;
        marketNote: string | null;
        seasonLabel: string;
        breakdown: {
            inputs: number;
            labor: number;
            operations: number;
            other: number;
        };
        breakdownByType: {
            label: string;
            value: number;
            color: string;
        }[];
        recentEntries: {
            id: string;
            dateLabel: string;
            category: string;
            amountInr: number;
            type: string;
            note: string | null;
            icon: string | null;
        }[];
    }>;
    createFieldFinding(farmerId: string, blockId: string, input: {
        diseasePest?: string;
        observations?: string;
        diseaseTone?: "healthy" | "warning" | "danger";
        actionTaken?: string;
    }): Promise<{
        id: string;
    }>;
    createBlockRecommendation(farmerId: string, blockId: string, input: {
        problem?: string;
        recommendation: string;
        dosage?: string;
        applicationMethod?: string;
    }): Promise<{
        id: string;
    }>;
};
//# sourceMappingURL=farmer-portal-mobile.service.d.ts.map