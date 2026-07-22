import type { MarketInsightBuildResult } from './market-insight.types.js';
export declare const marketInsightLegacyDataService: {
    build(params: {
        insightDate: string;
        farmerId: string;
        profile: Record<string, unknown>;
        marketName: string;
        crops: string[];
        districtLabel: string;
    }): Promise<MarketInsightBuildResult>;
};
//# sourceMappingURL=market-insight-legacy-data.service.d.ts.map