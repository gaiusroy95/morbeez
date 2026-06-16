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
    };
};
export declare const visitEnvironmentService: {
    getEnvironment(farmerId: string, blockId: string): Promise<VisitEnvironmentPayload>;
};
//# sourceMappingURL=visit-environment.service.d.ts.map