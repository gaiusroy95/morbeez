export type PlotIntelligenceTrends = {
    recurringIssues: Array<{
        label: string;
        count: number;
        lastAt?: string;
    }>;
    soilTrend?: {
        nitrogen?: number[];
        potassium?: number[];
        ph?: number[];
    };
    waterReadings?: Array<{
        key: string;
        value: string;
        at: string;
    }>;
    yieldHistory?: Array<{
        cropType: string;
        yieldKgPerAcre: number | null;
        harvestDate: string | null;
    }>;
    satelliteOverlays?: Array<{
        ndvi: number | null;
        capturedAt: string;
        provider: string;
    }>;
    regionalRiskFlags?: string[];
    outcomeHistory: Array<{
        issue: string;
        outcome: string | null;
        at: string;
    }>;
    visitCount12m: number;
};
export declare const plotDigitalTwinService: {
    buildSnapshot(blockId: string, farmerId: string): Promise<PlotIntelligenceTrends>;
    getLatest(blockId: string): Promise<PlotIntelligenceTrends | null>;
    formatForPrompt(trends: PlotIntelligenceTrends | null): string;
};
//# sourceMappingURL=plot-digital-twin.service.d.ts.map