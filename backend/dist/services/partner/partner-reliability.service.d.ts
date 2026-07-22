export declare const partnerReliabilityService: {
    recordSignal(input: {
        partnerId: string;
        signalType: string;
        signalValue?: number;
        farmerId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    recomputeScore(partnerId: string): Promise<{
        score: number;
        breakdown: Record<string, number>;
    }>;
    captureVisitSignals(input: {
        partnerId: string;
        farmerId: string;
        hasGps: boolean;
        photoCount: number;
        issueCount: number;
        durationMinutes?: number;
    }): Promise<{
        score: number;
        breakdown: Record<string, number>;
    }>;
};
//# sourceMappingURL=partner-reliability.service.d.ts.map