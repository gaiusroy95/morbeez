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