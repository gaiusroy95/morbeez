import type { MarketInsightBuildResult } from './market-insight.types.js';
export declare const marketInsightDataService: {
    todayInIst(): string;
    buildForFarmer(farmerId: string, insightDate?: string): Promise<MarketInsightBuildResult>;
};
//# sourceMappingURL=market-insight-data.service.d.ts.map