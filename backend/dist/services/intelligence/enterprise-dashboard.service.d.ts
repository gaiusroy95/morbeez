export declare const executiveCockpitService: {
    getCockpit(agentEmail?: string): Promise<{
        visits: number;
        recoveryRate: number | null;
        aiAccuracy: number | null;
        escalationRate: number | null;
        protocolSuccess: number;
        openEscalations: number;
    }>;
};
export declare const weaknessDashboardService: {
    getWeakness(days?: number, eventType?: string): Promise<{
        topMislabels: {
            crop: string;
            label: string;
            count: number;
        }[];
        districtDrift: {
            district: string;
            count: number;
        }[];
        byEventType: {
            eventType: string;
            count: number;
        }[];
        totalEvents: number;
    }>;
};
export declare const resistanceDashboardService: {
    aggregate(limit?: number): Promise<{
        crop: string;
        cases: number;
        avgResistanceScore: number;
    }[]>;
};
//# sourceMappingURL=enterprise-dashboard.service.d.ts.map