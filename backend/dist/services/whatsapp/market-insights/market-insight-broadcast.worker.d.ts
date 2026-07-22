import { marketInsightBroadcastService } from './market-insight-broadcast.service.js';
export declare function startMarketInsightBroadcastWorker(): void;
export declare function runMarketInsightsNow(options?: Parameters<typeof marketInsightBroadcastService.runDaily>[0]): Promise<{
    build: import("./market-insight-broadcast.service.js").MarketInsightRunResult;
    send: import("./market-insight-broadcast.service.js").MarketInsightRunResult;
}>;
//# sourceMappingURL=market-insight-broadcast.worker.d.ts.map