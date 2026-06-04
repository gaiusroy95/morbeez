type ActivityCostBreakdown = {
    labourCostInr?: number | null;
    sprayCostInr?: number | null;
    fertilizerCostInr?: number | null;
    machineryCostInr?: number | null;
};
type RoiExpenseType = 'labour' | 'purchase' | 'misc';
export declare const whatsappOsAdminService: {
    listFieldActivityBlocks(limit?: number): Promise<{
        id: any;
        farmer_id: any;
        name: any;
        plot_label: any;
        crop_type: any;
        stage: any;
        acreage_decimal: any;
        planting_date: any;
        latitude: any;
        longitude: any;
        created_at: any;
        farmers: {
            name: any;
            phone: any;
            district: any;
        }[];
    }[]>;
    listFieldActivityBlocksForFarmer(farmerId: string, limit?: number): Promise<{
        id: any;
        farmer_id: any;
        name: any;
        plot_label: any;
        crop_type: any;
        stage: any;
        acreage_decimal: any;
        planting_date: any;
        latitude: any;
        longitude: any;
        created_at: any;
        farmers: {
            name: any;
            phone: any;
            district: any;
        }[];
    }[]>;
    assertFarmBlockBelongsToFarmer(blockId: string, farmerId: string): Promise<void>;
    listFieldActivities(params: {
        blockId: string;
        limit?: number;
    }): Promise<any[]>;
    listFieldActivityTypes(params: {
        cropType?: string | null;
        activeOnly?: boolean;
    }): Promise<any[]>;
    createFieldActivityType(params: {
        activityName: string;
        category?: string;
        crop?: string | null;
        icon?: string | null;
        colorTag?: string | null;
        followupDefaultDays?: number | null;
    }): Promise<any>;
    listFieldPendingTasks(params: {
        blockId: string;
        limit?: number;
    }): Promise<any[]>;
    updateFieldBlockLocation(params: {
        blockId: string;
        latitude: number;
        longitude: number;
    }): Promise<{
        id: any;
        farmer_id: any;
        name: any;
        plot_label: any;
        crop_type: any;
        stage: any;
        acreage_decimal: any;
        planting_date: any;
        latitude: any;
        longitude: any;
        created_at: any;
        farmers: {
            name: any;
            phone: any;
            district: any;
        }[];
    } | null>;
    listMarketOptions(_cropType?: string): Promise<{
        id: string;
        market_name: string;
        district: string | null;
    }[]>;
    listFarmerMarketPreferences(params: {
        farmerId: string;
        cropType?: string;
    }): Promise<any[]>;
    saveFarmerMarketPreferences(params: {
        farmerId: string;
        cropType?: string;
        markets: Array<{
            marketName: string;
            district?: string | null;
        }>;
    }): Promise<any[]>;
    createFieldActivity(params: {
        blockId: string;
        activityType: "spray_applied" | "fertigation" | "drench" | "scouting" | "other";
        activityTypeId?: string;
        activityLabel?: string;
        activityDate: string;
        dap?: number | null;
        notes?: string;
        costInr?: number | null;
        costBreakdown?: ActivityCostBreakdown;
        followUpRequired?: boolean;
        followUpDate?: string | null;
        status?: "completed" | "pending" | "cancelled";
        source?: "admin" | "telecaller" | "whatsapp" | "system";
        assignedEmployee?: string;
    }): Promise<any>;
    syncFieldActivityToRoi(params: {
        farmerId: string;
        blockId: string;
        activityId: string;
        activityDate: string;
        amountInr: number;
        comments: string;
        roiEntryType: RoiExpenseType;
        roiCostType: "labour" | "spray" | "fertilizer" | "machinery" | "mixed";
    }): Promise<{
        roiEntryId: string;
    }>;
    getConversationSession(farmerId: string): Promise<any>;
    updateConversationSession(farmerId: string, patch: {
        aiPaused?: boolean;
        owner?: "ai" | "telecaller" | "agronomist";
        preferredLanguage?: string | null;
        activePlotId?: string | null;
        activeBlockId?: string | null;
    }): Promise<any>;
    listCropDailyPrices(cropType?: string): Promise<any[]>;
    upsertCropDailyPrice(row: {
        cropType: string;
        marketName: string;
        district?: string;
        pricePerKg: number;
        lastYearPricePerKg?: number;
        priceDate?: string;
    }): Promise<any>;
    listTerminologyReviewTasks(status?: string): Promise<any[]>;
    /** Manual queue entry (Operations UI) or testing without a live WhatsApp message. */
    createTerminologyReviewTask(params: {
        term: string;
        rawMessage?: string;
        language?: string;
        cropType?: string;
        district?: string;
        farmerId?: string;
        farmerPhone?: string;
    }): Promise<any>;
    updateTerminologyTask(id: string, patch: {
        status: "open" | "in_review" | "resolved" | "dismissed";
        resolutionMeaning?: string;
        standardTerm?: string;
        assignedTo?: string;
        resolvedBy?: string;
    }): Promise<any>;
};
export {};
//# sourceMappingURL=whatsapp-os-admin.service.d.ts.map