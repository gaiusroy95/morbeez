import { NotFoundError } from '../../lib/errors.js';
import { blockService } from './block.service.js';
import { weatherSnapshotService } from './weather-snapshot.service.js';
import { deriveWeatherPressures } from '../whatsapp/pipeline/weather-fetch.service.js';
import { ALL_SOIL_FIELDS, normalizeSoilMetrics } from '../soil/soil-lab-metrics.js';
import { crmFarmerService } from '../admin/crm-farmer.service.js';

export type VisitEnvironmentPayload = {
  soilReport: {
    reportedAt: string | null;
    labName: string | null;
    soilType: string | null;
    metrics: Array<{ key: string; label: string; value: string; unit: string; group: 'macro' | 'micro' }>;
  } | null;
  weather: {
    current: Record<string, unknown> | null;
    forecast: Record<string, unknown> | null;
    last7Days: Array<{
      date: string;
      temperatureC: number | null;
      humidityPct: number | null;
      rainfallMm: number | null;
    }>;
    totals7d: {
      rainfallMm: number;
      avgTempC: number;
      avgHumidityPct: number;
    } | null;
    pressures: {
      heatStress: boolean;
      waterlogging: boolean;
      fungalPressure: boolean;
      pestPressure: boolean;
      irrigationTrend: string;
    } | null;
  };
};

export const visitEnvironmentService = {
  async getEnvironment(farmerId: string, blockId: string): Promise<VisitEnvironmentPayload> {
    const block = await blockService.getById(blockId, farmerId);
    if (!block) throw new NotFoundError('Block not found');

    const [soilRows, weatherBundle] = await Promise.all([
      crmFarmerService.listSoilReports(farmerId, blockId).catch(() => []),
      weatherSnapshotService.getVisitWeatherBundle({ farmerId, blockId, days: 7 }).catch(() => null),
    ]);

    const latestSoil = soilRows[0] as Record<string, unknown> | undefined;
    const normalized = latestSoil?.metrics ? normalizeSoilMetrics(latestSoil.metrics) : null;

    const soilReport = latestSoil
      ? {
          reportedAt: latestSoil.reported_at ? String(latestSoil.reported_at) : null,
          labName: latestSoil.lab_name ? String(latestSoil.lab_name) : null,
          soilType: normalized?.soilType ?? null,
          metrics: ALL_SOIL_FIELDS.map((field) => {
            const group = field.group === 'macro' ? normalized?.macro : normalized?.micro;
            const cell = group?.[field.key];
            return {
              key: field.key,
              label: field.label,
              value: cell?.value?.trim() ? String(cell.value) : '—',
              unit: cell?.unit ?? field.unit,
              group: field.group,
            };
          }),
        }
      : null;

    const last7DaysRaw = weatherBundle?.last7Days ?? [];
    const today = last7DaysRaw[last7DaysRaw.length - 1];
    const alerts: string[] = [];
    if (weatherBundle?.heavyRainLikely) alerts.push('heavy_rain_likely');
    if (weatherBundle?.highHeatLikely) alerts.push('high_heat_likely');
    if (weatherBundle?.highHumidityLikely) alerts.push('high_humidity_likely');

    const last7Days = last7DaysRaw.map((d) => ({
      date: d.date,
      temperatureC: d.maxTempC,
      humidityPct: d.avgHumidityPct,
      rainfallMm: d.rainfallMm,
    }));
    const totals7d =
      last7Days.length > 0
        ? {
            rainfallMm: Math.round(last7Days.reduce((s, d) => s + (d.rainfallMm ?? 0), 0) * 10) / 10,
            avgTempC:
              Math.round(
                (last7Days.reduce((s, d) => s + (d.temperatureC ?? 0), 0) / last7Days.length) * 10
              ) / 10,
            avgHumidityPct:
              Math.round(
                (last7Days.reduce((s, d) => s + (d.humidityPct ?? 0), 0) / last7Days.length) * 10
              ) / 10,
          }
        : null;
    const pressures = last7DaysRaw.length ? deriveWeatherPressures(last7DaysRaw) : null;

    const weather = {
      current: today
        ? {
            temperatureC: today.maxTempC,
            humidityPct: today.avgHumidityPct,
            rainfallMm: today.rainfallMm,
            weatherRiskScore: weatherBundle?.weatherRiskScore ?? null,
            diseaseAlerts: alerts,
            locationLabel: weatherBundle?.locationLabel ?? null,
          }
        : null,
      forecast: weatherBundle
        ? {
            rainfallMmForecast: weatherBundle.forecastTomorrow.rainfallMm,
            heavyRainLikely: weatherBundle.heavyRainLikely,
            highHeatLikely: weatherBundle.highHeatLikely,
            highHumidityLikely: weatherBundle.highHumidityLikely,
          }
        : null,
      last7Days,
      totals7d,
      pressures,
    };

    return { soilReport, weather };
  },
};
