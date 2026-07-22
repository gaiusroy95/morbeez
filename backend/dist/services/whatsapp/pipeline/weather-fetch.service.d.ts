/** Shared Open-Meteo forecast for farmer location (pincode or district fallback). */
export type WeatherDailyRow = {
    date: string;
    rainfallMm: number;
    maxTempC: number;
    avgHumidityPct: number;
};
export type WeatherPressureSignals = {
    heatStress: boolean;
    waterlogging: boolean;
    fungalPressure: boolean;
    pestPressure: boolean;
    irrigationTrend: string;
};
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
export type WeatherBundle = {
    lat: number;
    lon: number;
    locationLabel: string;
    last7Days: WeatherDailyRow[];
    forecastTomorrow: WeatherDailyRow;
    heavyRainLikely: boolean;
    highHeatLikely: boolean;
    highHumidityLikely: boolean;
    weatherRiskScore: number;
};
/** Single Open-Meteo request: past week + tomorrow forecast. */
export declare function fetchWeatherBundle(coords: {
    lat: number;
    lon: number;
    label: string;
}, days?: number): Promise<WeatherBundle>;
/** Past N days of daily weather (Open-Meteo `past_days`, ending today). */
export declare function fetchWeatherPastDays(coords: {
    lat: number;
    lon: number;
    label: string;
}, days?: number): Promise<WeatherDailyRow[]>;
export declare function deriveWeatherPressures(days: WeatherDailyRow[]): WeatherPressureSignals;
//# sourceMappingURL=weather-fetch.service.d.ts.map