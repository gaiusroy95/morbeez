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

const DISTRICT_COORDS: Record<string, { lat: number; lon: number; label: string }> = {
  wayanad: { lat: 11.6854, lon: 76.132, label: 'Wayanad' },
  idukki: { lat: 9.9185, lon: 76.9438, label: 'Idukki' },
  ernakulam: { lat: 9.9312, lon: 76.2673, label: 'Ernakulam' },
  kochi: { lat: 9.9312, lon: 76.2673, label: 'Kochi' },
  thrissur: { lat: 10.5276, lon: 76.2144, label: 'Thrissur' },
  bengaluru: { lat: 12.9716, lon: 77.5946, label: 'Bengaluru' },
  bangalore: { lat: 12.9716, lon: 77.5946, label: 'Bengaluru' },
};

const DEFAULT = DISTRICT_COORDS.wayanad;

export function resolveCoords(params: {
  district?: string | null;
  plotLat?: number | null;
  plotLon?: number | null;
  plotLabel?: string | null;
  pincodeLat?: number | null;
  pincodeLon?: number | null;
  pincodeLabel?: string | null;
}): { lat: number; lon: number; label: string } {
  if (params.plotLat != null && params.plotLon != null) {
    return {
      lat: params.plotLat,
      lon: params.plotLon,
      label: params.plotLabel ?? 'Plot GPS',
    };
  }
  if (params.pincodeLat != null && params.pincodeLon != null) {
    return {
      lat: params.pincodeLat,
      lon: params.pincodeLon,
      label: params.pincodeLabel ?? params.district ?? 'Field location',
    };
  }
  const key = String(params.district ?? 'wayanad')
    .toLowerCase()
    .replace(/\s+/g, '');
  const hit = DISTRICT_COORDS[key];
  if (hit) return hit;
  return { ...DEFAULT, label: params.district ?? DEFAULT.label };
}

export async function fetchWeatherForecast(coords: {
  lat: number;
  lon: number;
  label: string;
}): Promise<WeatherForecast> {
  const bundle = await fetchWeatherBundle(coords);
  const today = bundle.last7Days[bundle.last7Days.length - 1];
  return {
    lat: bundle.lat,
    lon: bundle.lon,
    locationLabel: bundle.locationLabel,
    rainMmToday: today?.rainfallMm ?? 0,
    rainMmTomorrow: bundle.forecastTomorrow.rainfallMm,
    maxTempCToday: today?.maxTempC ?? 28,
    avgHumidityPct: today?.avgHumidityPct ?? 70,
    heavyRainLikely: bundle.heavyRainLikely,
    highHeatLikely: bundle.highHeatLikely,
    highHumidityLikely: bundle.highHumidityLikely,
    weatherRiskScore: bundle.weatherRiskScore,
  };
}

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
export async function fetchWeatherBundle(
  coords: { lat: number; lon: number; label: string },
  days = 7
): Promise<WeatherBundle> {
  const fallbackToday: WeatherDailyRow = {
    date: new Date().toISOString().slice(0, 10),
    rainfallMm: 0,
    maxTempC: 28,
    avgHumidityPct: 70,
  };
  const base: WeatherBundle = {
    lat: coords.lat,
    lon: coords.lon,
    locationLabel: coords.label,
    last7Days: Array.from({ length: days }, (_, i) => ({
      ...fallbackToday,
      date: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10),
    })),
    forecastTomorrow: { ...fallbackToday, rainfallMm: 0 },
    heavyRainLikely: false,
    highHeatLikely: false,
    highHumidityLikely: false,
    weatherRiskScore: 35,
  };

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(coords.lat));
    url.searchParams.set('longitude', String(coords.lon));
    url.searchParams.set(
      'daily',
      'precipitation_sum,temperature_2m_max,relative_humidity_2m_mean'
    );
    url.searchParams.set('past_days', String(Math.max(0, days - 1)));
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('timezone', 'Asia/Kolkata');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return base;

    const data = (await res.json()) as {
      daily?: {
        time?: string[];
        precipitation_sum?: number[];
        temperature_2m_max?: number[];
        relative_humidity_2m_mean?: number[];
      };
    };

    const daily = data.daily;
    if (!daily?.time?.length) return base;

    const rows: WeatherDailyRow[] = daily.time.map((date, i) => ({
      date,
      rainfallMm: Number(daily.precipitation_sum?.[i] ?? 0),
      maxTempC: Number(daily.temperature_2m_max?.[i] ?? 28),
      avgHumidityPct: Number(daily.relative_humidity_2m_mean?.[i] ?? 70),
    }));

    const last7Days = rows.length > 1 ? rows.slice(0, -1) : rows;
    const today = last7Days[last7Days.length - 1] ?? rows[0] ?? fallbackToday;
    const tomorrow = rows[rows.length - 1] ?? today;

    const heavyRainLikely = today.rainfallMm >= 10 || tomorrow.rainfallMm >= 15;
    const highHeatLikely = today.maxTempC >= 34;
    const highHumidityLikely = today.avgHumidityPct >= 82;
    const weatherRiskScore = Math.min(
      100,
      Math.round(
        today.rainfallMm * 4 +
          tomorrow.rainfallMm * 2 +
          Math.max(0, today.avgHumidityPct - 75) * 1.2 +
          Math.max(0, today.maxTempC - 30) * 6
      )
    );

    return {
      lat: coords.lat,
      lon: coords.lon,
      locationLabel: coords.label,
      last7Days,
      forecastTomorrow: tomorrow,
      heavyRainLikely,
      highHeatLikely,
      highHumidityLikely,
      weatherRiskScore,
    };
  } catch {
    return base;
  }
}

/** Past N days of daily weather (Open-Meteo `past_days`, ending today). */
export async function fetchWeatherPastDays(
  coords: { lat: number; lon: number; label: string },
  days = 7
): Promise<WeatherDailyRow[]> {
  const bundle = await fetchWeatherBundle(coords, days);
  return bundle.last7Days;
}

export function deriveWeatherPressures(days: WeatherDailyRow[]): WeatherPressureSignals {
  if (!days.length) {
    return {
      heatStress: false,
      waterlogging: false,
      fungalPressure: false,
      pestPressure: false,
      irrigationTrend: 'Weather history unavailable',
    };
  }

  const totalRain = days.reduce((sum, d) => sum + d.rainfallMm, 0);
  const avgTemp = days.reduce((sum, d) => sum + d.maxTempC, 0) / days.length;
  const avgHumidity = days.reduce((sum, d) => sum + d.avgHumidityPct, 0) / days.length;
  const hotDays = days.filter((d) => d.maxTempC >= 34).length;
  const heavyRainDays = days.filter((d) => d.rainfallMm >= 10).length;
  const humidDays = days.filter((d) => d.avgHumidityPct >= 82).length;
  const recentRain = days.slice(-3).reduce((sum, d) => sum + d.rainfallMm, 0);

  let irrigationTrend = 'Moderate rainfall — normal irrigation pattern';
  if (recentRain < 5 && totalRain < 15) {
    irrigationTrend = 'Dry trend — irrigation demand likely elevated';
  } else if (recentRain >= 20 || totalRain >= 50) {
    irrigationTrend = 'Wet trend — irrigation reduced; check drainage';
  }

  return {
    heatStress: hotDays >= 2 || avgTemp >= 33,
    waterlogging: heavyRainDays >= 2 || totalRain >= 45,
    fungalPressure: humidDays >= 3 || (avgHumidity >= 80 && totalRain >= 20),
    pestPressure: avgHumidity >= 75 && avgTemp >= 26 && avgTemp <= 32,
    irrigationTrend,
  };
}
