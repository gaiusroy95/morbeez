import { supabase } from '../../lib/supabase.js';
import { NotFoundError } from '../../lib/errors.js';
import { blockService } from './block.service.js';
import { weatherSnapshotService } from './weather-snapshot.service.js';
export const visitAiContextService = {
    async buildVisitAiContext(input) {
        const block = await blockService.getById(input.blockId, input.farmerId);
        if (!block)
            throw new NotFoundError('Block not found');
        const [{ data: soilRows }, weatherSnapshot] = await Promise.all([
            supabase
                .from('crm_soil_reports')
                .select('metrics, reported_at, lab_name')
                .eq('farmer_id', input.farmerId)
                .or(`block_id.eq.${input.blockId},block_id.is.null`)
                .order('reported_at', { ascending: false })
                .limit(1),
            weatherSnapshotService
                .capture({
                farmerId: input.farmerId,
                blockId: input.blockId,
                eventType: 'field_finding',
                eventId: input.sessionId ?? null,
            })
                .catch(() => null),
        ]);
        const soil = soilRows?.[0];
        const soilTestSummary = soil
            ? {
                reportedAt: soil.reported_at ? String(soil.reported_at) : null,
                labName: soil.lab_name ? String(soil.lab_name) : null,
                metrics: soil.metrics ?? {},
            }
            : null;
        const lat = input.latitude ?? (block.latitude != null ? Number(block.latitude) : null);
        const lon = input.longitude ?? (block.longitude != null ? Number(block.longitude) : null);
        const weatherCtx = weatherSnapshot?.context ?? null;
        return {
            farmerId: input.farmerId,
            blockId: input.blockId,
            sessionId: input.sessionId,
            cropType: block.crop_type,
            dap: block.dap ?? null,
            stage: block.stage ?? null,
            blockAssessment: input.blockAssessment,
            measurements: input.measurements ?? [],
            soilTestSummary,
            weatherSnapshot: weatherCtx
                ? {
                    rainfallMm: weatherCtx.rainfall_mm ?? null,
                    humidityPct: weatherCtx.humidity_pct ?? null,
                    temperatureC: weatherCtx.temperature_c ?? null,
                    weatherRiskScore: weatherCtx.weather_risk_score ?? null,
                    diseaseAlerts: weatherCtx.disease_alerts ?? [],
                    locationLabel: weatherCtx.location_label ?? null,
                }
                : null,
            gps: lat != null && lon != null ? { latitude: lat, longitude: lon } : null,
        };
    },
};
//# sourceMappingURL=visit-ai-context.service.js.map