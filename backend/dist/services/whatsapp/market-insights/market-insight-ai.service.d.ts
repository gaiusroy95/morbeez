import type { FarmerPincodeRegion } from './market-insight-region.service.js';
import type { MarketInsightPayload } from './market-insight.types.js';
export declare const marketInsightAiService: {
    fetchVerifiedWeather(region: FarmerPincodeRegion): Promise<{
        conditionLabel: string;
        tempC: number;
        humidityPct: number;
        rainMmToday: number;
        locationLabel: string;
    } | null>;
    getCached(pincode: string, insightDate: string): Promise<MarketInsightPayload | null>;
    saveCache(pincode: string, insightDate: string, district: string, payload: MarketInsightPayload, model: string): Promise<void>;
    fetchForPincode(region: FarmerPincodeRegion, insightDate: string): Promise<MarketInsightPayload | null>;
};
//# sourceMappingURL=market-insight-ai.service.d.ts.map