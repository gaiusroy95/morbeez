import { supabase } from '../../../lib/supabase.js';
import { seasonalPriorityService } from './seasonal-priority.service.js';
import { fetchWeatherForecast } from './weather-fetch.service.js';
import { diseaseWeatherRulesService, } from './disease-weather-rules.service.js';
import { nearbyCasesService } from './nearby-cases.service.js';
import { plotLocationService } from '../../core/plot-location.service.js';
export const contextPackService = {
    async build(farmerId, options) {
        const { data: farmer } = await supabase
            .from('farmers')
            .select('district, village, metadata, pincode_id, active_block_id, pincode_master(pincode, district, latitude, longitude, village)')
            .eq('id', farmerId)
            .maybeSingle();
        const pm = farmer?.pincode_master;
        const blockId = options?.blockId ?? (farmer?.active_block_id ? String(farmer.active_block_id) : null);
        const resolved = await plotLocationService.resolveWeatherCoords(farmerId, blockId);
        const weather = await fetchWeatherForecast({
            lat: resolved.lat,
            lon: resolved.lon,
            label: resolved.label,
        });
        const seasonPhase = seasonalPriorityService.currentPhase();
        const meta = (farmer?.metadata ?? {});
        const soilPh = meta.soilPh != null ? Number(meta.soilPh) : undefined;
        const soilEc = meta.soilEc != null ? Number(meta.soilEc) : undefined;
        const drainageRisk = weather.heavyRainLikely
            ? 'high'
            : weather.weatherRiskScore >= 45
                ? 'moderate'
                : 'low';
        const env = {
            seasonPhase,
            heavyRainLikely: weather.heavyRainLikely,
            highHumidityLikely: weather.highHumidityLikely,
            weatherRiskScore: weather.weatherRiskScore,
        };
        const cropType = options?.cropType ?? 'ginger';
        const diseasePriors = diseaseWeatherRulesService.evaluate({
            cropType,
            env,
            symptomsText: options?.symptomsText,
            dap: options?.dap,
        });
        const nearby = await nearbyCasesService.summarize(farmerId, cropType);
        const nearbySummary = nearbyCasesService.formatForPrompt(nearby);
        const pack = {
            district: farmer?.district ? String(farmer.district) : pm?.district,
            pincode: pm?.pincode ?? undefined,
            village: farmer?.village ? String(farmer.village) : pm?.village ?? undefined,
            coordSource: resolved.coordSource,
            seasonPhase,
            weatherRiskScore: weather.weatherRiskScore,
            heavyRainLikely: weather.heavyRainLikely,
            highHeatLikely: weather.highHeatLikely,
            highHumidityLikely: weather.highHumidityLikely,
            avgHumidityPct: weather.avgHumidityPct,
            rainMmToday: weather.rainMmToday,
            maxTempCToday: weather.maxTempCToday,
            soilPh,
            soilEc,
            drainageRisk,
            diseasePriors,
            nearbySummary: nearbySummary || undefined,
        };
        return pack;
    },
    /** Farmer- and model-facing environmental block for Crop Doctor / conversational AI. */
    formatForPrompt(pack) {
        const lines = [];
        const loc = [pack.village, pack.district, pack.pincode ? `PIN ${pack.pincode}` : null]
            .filter(Boolean)
            .join(', ');
        if (loc) {
            const gpsNote = pack.coordSource === 'plot_gps' ? ' (plot GPS)' : pack.coordSource === 'pincode' ? ' (pincode)' : '';
            lines.push(`Field location: ${loc}${gpsNote}.`);
        }
        lines.push(`Season (Kerala IST): ${pack.seasonPhase}.`);
        lines.push(`Weather at field: rain today ${pack.rainMmToday ?? '?'} mm, max temp ${pack.maxTempCToday ?? '?'} °C, mean humidity ${pack.avgHumidityPct ?? '?'}%.`);
        if (pack.heavyRainLikely)
            lines.push('Heavy rain likely — leaf wetness high; fungal/airborne disease risk elevated.');
        if (pack.highHumidityLikely) {
            lines.push('High atmospheric humidity — favour blast (Pyricularia), anthracnose, and rhizome rot in waterlogged soils.');
        }
        if (pack.highHeatLikely)
            lines.push('High heat likely — avoid midday foliar sprays.');
        lines.push(`Weather risk score: ${pack.weatherRiskScore}/100; drainage risk: ${pack.drainageRisk}.`);
        const priors = diseaseWeatherRulesService.formatForPrompt(pack.diseasePriors);
        if (priors) {
            lines.push('Morbeez disease–weather priors (use with photo/symptoms; do not ignore contradictory visuals):');
            lines.push(priors);
        }
        if (pack.nearbySummary) {
            lines.push('Regional field intelligence:');
            lines.push(pack.nearbySummary);
        }
        return lines.join('\n');
    },
};
//# sourceMappingURL=context-pack.service.js.map