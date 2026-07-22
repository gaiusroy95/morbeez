export declare const predictiveRiskService: {
    scoreBlock(params: {
        farmerId: string;
        blockId?: string | null;
        cropType?: string;
        contextPack?: {
            weatherRiskScore?: number;
            heavyRainLikely?: boolean;
            highHeatLikely?: boolean;
            highHumidityLikely?: boolean;
            drainageRisk?: "low" | "moderate" | "high";
        };
        riskTagCount?: number;
        regionalClusterKey?: string;
    }): Promise<{
        disease: number;
        pest: number;
        nutrient: number;
        irrigation: number;
        weather: number;
    }>;
};
//# sourceMappingURL=predictive-risk.service.d.ts.map