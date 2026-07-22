export type VisitEnvironmentPayload = {
    soilReport: {
        reportedAt: string | null;
        labName: string | null;
        soilType: string | null;
        metrics: Array<{
            key: string;
            label: string;
            value: string;
            unit: string;
            group: 'macro' | 'micro';
        }>;
    } | null;
    weather: {
        current: Record<string, unknown> | null;
        forecast: Record<string, unknown> | null;
        last7Days: Array<{
            date: string;
            temperatureC: number | null;
            humidityPct: number | null;
            rainfallMm: number | null;
        }>;
        totals7d: {
            rainfallMm: number;
            avgTempC: number;
            avgHumidityPct: number;
        } | null;
        pressures: {
            heatStress: boolean;
            waterlogging: boolean;
            fungalPressure: boolean;
            pestPressure: boolean;
            irrigationTrend: string;
        } | null;
    };
};
export declare const visitEnvironmentService: {
    getEnvironment(farmerId: string, blockId: string): Promise<VisitEnvironmentPayload>;
};
//# sourceMappingURL=visit-environment.service.d.ts.map