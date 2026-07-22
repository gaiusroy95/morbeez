export type BroadcastAudienceFilter = {
    cropTypes?: string[];
    districts?: string[];
    languages?: string[];
    broadcastTags?: string[];
    farmerCategories?: string[];
};
export type CampaignCategory = 'cultivation_advisory' | 'fertigation_reminder' | 'pest_disease_alert' | 'weather_alert' | 'market_price_update' | 'custom_message';
export declare const broadcastCampaignService: {
    listCampaigns(opts?: {
        status?: string;
        limit?: number;
    }): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }[]>;
    getCampaign(id: string): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    createCampaign(input: {
        name: string;
        category: CampaignCategory;
        audienceJson?: BroadcastAudienceFilter;
        messageTitle?: string;
        messageBody?: string;
        languageMode?: string;
        mediaUrls?: string[];
        templateId?: string;
        createdBy?: string;
    }): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    updateCampaign(id: string, patch: Partial<{
        name: string;
        category: CampaignCategory;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        status: string;
        scheduledAt: string | null;
        approvedBy: string;
    }>): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    previewAudience(filter: BroadcastAudienceFilter): Promise<{
        count: number;
        sample: import("./broadcast-variables.js").BroadcastVariableContext[];
    }>;
    previewMessage(campaignId: string, farmerId?: string): Promise<{
        farmerId: string;
        title: string | null;
        body: string;
        context: import("./broadcast-variables.js").BroadcastVariableContext;
    }>;
    scheduleCampaign(id: string, scheduledAt: string): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    submitForApproval(id: string): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    approveCampaign(id: string, approvedBy: string): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    cancelCampaign(id: string): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    sendCampaign(id: string, opts?: {
        dryRun?: boolean;
    }): Promise<{
        sent: number;
        skipped: number;
        failed: number;
        audience: number;
    }>;
    listTemplates(opts?: {
        status?: string;
    }): Promise<{
        id: string;
        name: string;
        category: string;
        cropType: string | null;
        targetDap: number | null;
        title: string | null;
        body: string;
        language: string;
        mediaUrls: string[];
        status: string;
        version: number;
        createdBy: string | null;
        approvedBy: string | null;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createTemplate(input: {
        name: string;
        category: string;
        cropType?: string;
        targetDap?: number;
        title?: string;
        body: string;
        language?: string;
        mediaUrls?: string[];
        createdBy?: string;
    }): Promise<{
        id: string;
        name: string;
        category: string;
        cropType: string | null;
        targetDap: number | null;
        title: string | null;
        body: string;
        language: string;
        mediaUrls: string[];
        status: string;
        version: number;
        createdBy: string | null;
        approvedBy: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    updateTemplate(id: string, patch: Partial<{
        name: string;
        body: string;
        title: string;
        status: string;
        approvedBy: string;
    }>): Promise<{
        id: string;
        name: string;
        category: string;
        cropType: string | null;
        targetDap: number | null;
        title: string | null;
        body: string;
        language: string;
        mediaUrls: string[];
        status: string;
        version: number;
        createdBy: string | null;
        approvedBy: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    cloneTemplateToCampaign(templateId: string, createdBy?: string): Promise<{
        id: string;
        name: string;
        category: string;
        status: string;
        audienceJson: BroadcastAudienceFilter;
        messageTitle: string | null;
        messageBody: string;
        languageMode: string;
        mediaUrls: string[];
        templateId: string | null;
        scheduledAt: string | null;
        sentAt: string | null;
        createdBy: string | null;
        approvedBy: string | null;
        statsJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    exportDeliveriesCsv(opts?: {
        campaignId?: string;
        limit?: number;
    }): Promise<string>;
    processScheduledCampaigns(): Promise<{
        sent: number;
        skipped: number;
        failed: number;
        audience: number;
    }[]>;
    recordDeliveryStatus(params: {
        whatsappMessageId: string;
        status: "delivered" | "read";
    }): Promise<{
        id: any;
        campaign_id: any;
    } | null>;
    getCampaignAnalytics(opts?: {
        campaignId?: string;
        days?: number;
    }): Promise<{
        totals: {
            sent: number;
            failed: number;
            skipped: number;
            delivered: number;
            read: number;
            replied: number;
        };
        byKind: {
            total: number;
            sent: number;
            failed: number;
            skipped: number;
            kind: string;
        }[];
        periodDays: number;
    }>;
    listPendingApprovals(): Promise<{
        campaigns: {
            id: string;
            name: string;
            category: string;
            status: string;
            audienceJson: BroadcastAudienceFilter;
            messageTitle: string | null;
            messageBody: string;
            languageMode: string;
            mediaUrls: string[];
            templateId: string | null;
            scheduledAt: string | null;
            sentAt: string | null;
            createdBy: string | null;
            approvedBy: string | null;
            statsJson: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
        }[];
        templates: {
            id: string;
            name: string;
            category: string;
            cropType: string | null;
            targetDap: number | null;
            title: string | null;
            body: string;
            language: string;
            mediaUrls: string[];
            status: string;
            version: number;
            createdBy: string | null;
            approvedBy: string | null;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    getFarmerPreferences(farmerId: string): Promise<{
        farmerId: string;
        optedOutAll: boolean;
        optedOutCategories: string[];
    }>;
    updateFarmerPreferences(farmerId: string, patch: {
        optedOutAll?: boolean;
        optedOutCategories?: string[];
    }): Promise<{
        farmerId: string;
        optedOutAll: boolean;
        optedOutCategories: string[];
    }>;
};
//# sourceMappingURL=broadcast-campaign.service.d.ts.map