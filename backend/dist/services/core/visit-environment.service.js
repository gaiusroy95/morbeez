import { NotFoundError } from '../../lib/errors.js';
import { blockService } from './block.service.js';
import { weatherSnapshotService } from './weather-snapshot.service.js';
import { ALL_SOIL_FIELDS, normalizeSoilMetrics } from '../soil/soil-lab-metrics.js';
import { crmFarmerService } from '../admin/crm-farmer.service.js';
export const visitEnvironmentService = {
    async getEnvironment(farmerId, blockId) {
        const block = await blockService.getById(blockId, farmerId);
        if (!block)
            throw new NotFoundError('Block not found');
        const [soilRows, weatherSnapshot] = await Promise.all([
            crmFarmerService.listSoilReports(farmerId, blockId).catch(() => []),
            weatherSnapshotService
                .capture({
                farmerId,
                blockId,
                eventType: 'field_finding',
                eventId: null,
            })
                .catch(() => null),
        ]);
        const latestSoil = soilRows[0];
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
        const ctx = weatherSnapshot?.context ?? null;
        const weather = {
            current: ctx
                ? {
                    temperatureC: ctx.temperature_c ?? null,
                    humidityPct: ctx.humidity_pct ?? null,
                    rainfallMm: ctx.rainfall_mm ?? null,
                    weatherRiskScore: ctx.weather_risk_score ?? null,
                    diseaseAlerts: ctx.disease_alerts ?? [],
                    locationLabel: ctx.location_label ?? null,
                }
                : null,
            forecast: ctx
                ? {
                    rainfallMmForecast: ctx.rainfall_mm_forecast ?? null,
                    heavyRainLikely: Boolean(ctx.disease_alerts?.includes('heavy_rain_likely')),
                    highHeatLikely: Boolean(ctx.disease_alerts?.includes('high_heat_likely')),
                    highHumidityLikely: Boolean(ctx.disease_alerts?.includes('high_humidity_likely')),
                }
                : null,
        };
        return { soilReport, weather };
    },
};
//# sourceMappingURL=visit-environment.service.js.map