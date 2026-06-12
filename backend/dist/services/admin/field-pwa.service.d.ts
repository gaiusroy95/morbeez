export declare const fieldPwaService: {
    searchFarmers(q: string, limit?: number): Promise<{
        id: string;
        phone: string | null | undefined;
        name: string;
        district: string | null | undefined;
        village: string | null | undefined;
        preferredLanguage: string;
    }[]>;
    /** Recent farmers for browse lists (no search term required). */
    listRecentFarmers(limit?: number): Promise<{
        id: string;
        phone: string | null | undefined;
        name: string;
        district: string | null | undefined;
        village: string | null | undefined;
        preferredLanguage: string;
    }[]>;
    getFarmerBlocks(farmerId: string): Promise<{
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
    }[]>;
    saveBlockLocation(input: {
        blockId: string;
        farmerId: string;
        latitude: number;
        longitude: number;
    }): Promise<import("../core/block.service.js").BlockWithDap>;
    getQuestionnaire(cropType: string): Promise<{
        id: any;
        questionKey: any;
        labelEn: any;
        labelMl: any;
        inputType: any;
        options: string[];
        required: any;
        sortOrder: any;
    }[]>;
    submitVisit(input: {
        farmerId: string;
        blockId: string;
        blockName: string;
        cropType: string;
        leadId?: string;
        agronomistName: string;
        agronomistEmail: string;
        observations?: string;
        diseasePest?: string;
        diseaseTone?: "healthy" | "warning" | "danger";
        actionTaken?: string;
        answers: Array<{
            questionKey: string;
            label: string;
            value: string;
        }>;
        photos?: Array<{
            filename: string;
            mimeType: string;
            dataBase64: string;
        }>;
        latitude?: number;
        longitude?: number;
    }): Promise<{
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
        photoUrls: string[];
    }>;
    listRecentVisits(agronomistEmail: string, limit?: number, farmerId?: string): Promise<{
        id: any;
        farmer_id: any;
        block_name: any;
        crop_type: any;
        disease_pest: any;
        visited_at: any;
        photo_urls: any;
        agronomist_name: any;
        farmers: {
            name: any;
            phone: any;
        }[];
    }[]>;
};
//# sourceMappingURL=field-pwa.service.d.ts.map