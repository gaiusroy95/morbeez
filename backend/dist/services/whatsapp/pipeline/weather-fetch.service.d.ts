/** Shared Open-Meteo forecast for farmer location (pincode or district fallback). */
export type WeatherForecast = {
    lat: number;
    lon: number;
    locationLabel: string;
    rainMmToday: number;
    rainMmTomorrow: number;
    maxTempCToday: number;
    avgHumidityPct: number;
    heavyRainLikely: boolean;
    highHeatLikely: boolean;
    highHumidityLikely: boolean;
    weatherRiskScore: number;
};
export declare function resolveCoords(params: {
    district?: string | null;
    plotLat?: number | null;
    plotLon?: number | null;
    plotLabel?: string | null;
    pincodeLat?: number | null;
    pincodeLon?: number | null;
    pincodeLabel?: string | null;
}): {
    lat: number;
    lon: number;
    label: string;
};
export declare function fetchWeatherForecast(coords: {
    lat: number;
    lon: number;
    label: string;
}): Promise<WeatherForecast>;
//# sourceMappingURL=weather-fetch.service.d.ts.map