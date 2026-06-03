type RainBand = {
    key: string;
    label: string;
    findingCount: number;
    diseaseCount: number;
    pestCount: number;
    weatherStressCount: number;
    diseaseRatePct: number;
};
export declare const weatherCorrelationService: {
    getAnalytics(days?: number): Promise<{
        periodDays: number;
        since: string;
        snapshotCount: number;
        snapshotsByEventType: Record<string, number>;
        fieldFindingsAnalyzed: number;
        findingsWithWeather: number;
        findingsWeatherCoveragePct: number;
        rainfallBands: RainBand[];
        highHumidity: {
            visits: number;
            diseaseSignals: number;
            ratePct: number;
        };
        postHeavyRain: {
            visits: number;
            diseaseRatePct: number;
            liftVsDryPct: number;
        };
        captureCoverage: {
            trainingEvents: {
                total: number;
                withWeather: number;
                pct: number;
            };
            cropImages: {
                total: number;
                withWeather: number;
                pct: number;
            };
            fieldActivities: {
                total: number;
                withWeather: number;
                pct: number;
            };
        };
        insights: string[];
    }>;
};
export {};
//# sourceMappingURL=weather-correlation.service.d.ts.map