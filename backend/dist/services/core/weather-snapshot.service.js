import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { fetchWeatherForecast, fetchWeatherBundle, fetchWeatherPastDays, resolveCoords, } from '../whatsapp/pipeline/weather-fetch.service.js';
function forecastToSnapshotContext(forecast) {
    const alerts = [];
    if (forecast.heavyRainLikely)
        alerts.push('heavy_rain_likely');
    if (forecast.highHeatLikely)
        alerts.push('high_heat_likely');
    if (forecast.highHumidityLikely)
        alerts.push('high_humidity_likely');
    return {
        rainfall_mm: forecast.rainMmToday,
        rainfall_mm_forecast: forecast.rainMmTomorrow,
        humidity_pct: forecast.avgHumidityPct,
        temperature_c: forecast.maxTempCToday,
        weather_risk_score: forecast.weatherRiskScore,
        disease_alerts: alerts,
        location_label: forecast.locationLabel,
        lat: forecast.lat,
        lon: forecast.lon,
    };
}
async function resolveLocationForBlock(blockId) {
    const { data: block } = await supabase
        .from('farm_blocks')
        .select(`id, farmer_id, latitude, longitude, plot_label, pincode_id,
       farmers(district, pincode_id, pincode_master:pincode_id(latitude, longitude, pincode, village))`)
        .eq('id', blockId)
        .maybeSingle();
    if (!block) {
        return { farmerId: null, coords: resolveCoords({ district: 'wayanad' }) };
    }
    const farmer = block.farmers;
    const pm = farmer?.pincode_master;
    const coords = resolveCoords({
        district: farmer?.district,
        plotLat: block.latitude != null ? Number(block.latitude) : null,
        plotLon: block.longitude != null ? Number(block.longitude) : null,
        plotLabel: block.plot_label,
        pincodeLat: pm?.latitude != null ? Number(pm.latitude) : null,
        pincodeLon: pm?.longitude != null ? Number(pm.longitude) : null,
        pincodeLabel: pm?.village ?? pm?.pincode,
    });
    return { farmerId: block.farmer_id ? String(block.farmer_id) : null, coords };
}
async function resolveLocationForFarmer(farmerId) {
    const { data: farmer } = await supabase
        .from('farmers')
        .select('district, pincode_id, pincode_master:pincode_id(latitude, longitude, pincode, village)')
        .eq('id', farmerId)
        .maybeSingle();
    const pm = farmer?.pincode_master;
    return resolveCoords({
        district: farmer?.district,
        pincodeLat: pm?.latitude != null ? Number(pm.latitude) : null,
        pincodeLon: pm?.longitude != null ? Number(pm.longitude) : null,
        pincodeLabel: pm?.village ?? pm?.pincode,
    });
}
export const weatherSnapshotService = {
    async getVisitWeatherBundle(params) {
        try {
            let coords;
            if (params.blockId) {
                const loc = await resolveLocationForBlock(params.blockId);
                coords = loc.coords;
            }
            else if (params.farmerId) {
                coords = await resolveLocationForFarmer(params.farmerId);
            }
            else {
                coords = resolveCoords({ district: 'wayanad' });
            }
            return fetchWeatherBundle(coords, params.days ?? 7);
        }
        catch (err) {
            logger.warn({ err }, 'Weather bundle fetch failed');
            return null;
        }
    },
    async getDailyHistory(params) {
        try {
            let coords;
            if (params.blockId) {
                const loc = await resolveLocationForBlock(params.blockId);
                coords = loc.coords;
            }
            else if (params.farmerId) {
                coords = await resolveLocationForFarmer(params.farmerId);
            }
            else {
                coords = resolveCoords({ district: 'wayanad' });
            }
            return fetchWeatherPastDays(coords, params.days ?? 7);
        }
        catch (err) {
            logger.warn({ err }, 'Weather daily history fetch failed');
            return [];
        }
    },
    /** Persist Open-Meteo forecast at event time for AI training correlation. */
    async capture(params) {
        try {
            let farmerId = params.farmerId ?? null;
            let coords;
            if (params.blockId) {
                const loc = await resolveLocationForBlock(params.blockId);
                farmerId = farmerId ?? loc.farmerId;
                coords = loc.coords;
            }
            else if (farmerId) {
                coords = await resolveLocationForFarmer(farmerId);
            }
            else {
                coords = resolveCoords({ district: 'wayanad' });
            }
            const forecast = await fetchWeatherForecast(coords);
            const context = forecastToSnapshotContext(forecast);
            const alerts = context.disease_alerts ?? [];
            const { data, error } = await supabase
                .from('weather_snapshots')
                .insert({
                farmer_id: farmerId,
                block_id: params.blockId ?? null,
                event_type: params.eventType,
                event_id: params.eventId ?? null,
                latitude: forecast.lat,
                longitude: forecast.lon,
                location_label: forecast.locationLabel,
                rainfall_mm: forecast.rainMmToday,
                rainfall_mm_forecast: forecast.rainMmTomorrow,
                humidity_pct: forecast.avgHumidityPct,
                temperature_c: forecast.maxTempCToday,
                weather_risk_score: forecast.weatherRiskScore,
                disease_alerts: alerts,
                raw_forecast: forecast,
            })
                .select('id')
                .single();
            if (error) {
                logger.warn({ err: error.message, eventType: params.eventType }, 'Weather snapshot insert failed');
                return null;
            }
            return { snapshotId: String(data.id), context };
        }
        catch (err) {
            logger.warn({ err, eventType: params.eventType }, 'Weather snapshot capture failed');
            return null;
        }
    },
    async getById(id) {
        const { data } = await supabase.from('weather_snapshots').select('*').eq('id', id).maybeSingle();
        if (!data)
            return null;
        return {
            id: String(data.id),
            farmerId: data.farmer_id ? String(data.farmer_id) : null,
            blockId: data.block_id ? String(data.block_id) : null,
            eventType: data.event_type,
            eventId: data.event_id ? String(data.event_id) : null,
            capturedAt: String(data.captured_at),
            rainfallMm: data.rainfall_mm != null ? Number(data.rainfall_mm) : null,
            rainfallMmForecast: data.rainfall_mm_forecast != null ? Number(data.rainfall_mm_forecast) : null,
            humidityPct: data.humidity_pct != null ? Number(data.humidity_pct) : null,
            temperatureC: data.temperature_c != null ? Number(data.temperature_c) : null,
            weatherRiskScore: data.weather_risk_score != null ? Number(data.weather_risk_score) : null,
            diseaseAlerts: data.disease_alerts ?? [],
            locationLabel: data.location_label ? String(data.location_label) : null,
        };
    },
    /** Map event source channel → weather event type */
    mapSourceToEventType(source) {
        if (source === 'field_visit')
            return 'field_finding';
        if (source === 'whatsapp')
            return 'ai_session';
        if (source === 'crm')
            return 'recommendation';
        return 'manual';
    },
    mapReviewSurfaceToEventType(surface) {
        if (surface === 'field_finding' || surface === 'image_review')
            return 'field_finding';
        if (surface === 'case_review' ||
            surface === 'farmer_feedback' ||
            surface === 'telecaller_escalation') {
            return 'ai_session';
        }
        return 'manual';
    },
    async linkSnapshotToEvent(snapshotId, eventId) {
        await supabase.from('weather_snapshots').update({ event_id: eventId }).eq('id', snapshotId);
    },
    /** Resolve weather context for training — reuse finding weather or capture fresh. */
    async resolveForTraining(params) {
        if (params.fieldFindingId) {
            const { data: ff } = await supabase
                .from('crm_field_findings')
                .select('weather_snapshot_id, weather_context')
                .eq('id', params.fieldFindingId)
                .maybeSingle();
            if (ff?.weather_snapshot_id) {
                return {
                    weatherSnapshotId: String(ff.weather_snapshot_id),
                    weatherContext: ff.weather_context ?? {},
                };
            }
        }
        const eventType = this.mapReviewSurfaceToEventType(params.reviewSurface);
        const captured = await this.capture({
            farmerId: params.farmerId,
            blockId: params.blockId,
            eventType,
            eventId: params.aiSessionId ?? params.linkEventId ?? null,
        });
        if (!captured) {
            return { weatherSnapshotId: null, weatherContext: {} };
        }
        if (params.linkEventId) {
            await this.linkSnapshotToEvent(captured.snapshotId, params.linkEventId);
        }
        return {
            weatherSnapshotId: captured.snapshotId,
            weatherContext: captured.context,
        };
    },
};
//# sourceMappingURL=weather-snapshot.service.js.map