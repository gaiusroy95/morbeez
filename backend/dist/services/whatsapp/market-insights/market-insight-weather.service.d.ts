export type MarketInsightWeather = {
    conditionLabel: string;
    tempC: number;
    humidityPct: number;
    rainMmToday: number;
    locationLabel: string;
};
/** Weather for market insights — coordinates from farmer PIN code, not plot GPS. */
export declare const marketInsightWeatherService: {
    fetchForFarmer(farmerId: string): Promise<MarketInsightWeather>;
};
//# sourceMappingURL=market-insight-weather.service.d.ts.map