export type MarketInsightRunResult = {
    farmersScanned: number;
    built: number;
    sent: number;
    skipped: number;
    failed: number;
    errors: string[];
};
export declare const marketInsightBroadcastService: {
    buildSnapshots(options?: {
        farmerId?: string;
        insightDate?: string;
        dryRun?: boolean;
    }): Promise<MarketInsightRunResult>;
    sendSnapshots(options?: {
        farmerId?: string;
        insightDate?: string;
        dryRun?: boolean;
    }): Promise<MarketInsightRunResult>;
    runDaily(options?: {
        farmerId?: string;
        insightDate?: string;
        dryRun?: boolean;
        phase?: "build" | "send" | "both";
    }): Promise<{
        build: MarketInsightRunResult;
        send: MarketInsightRunResult;
    }>;
};
//# sourceMappingURL=market-insight-broadcast.service.d.ts.map