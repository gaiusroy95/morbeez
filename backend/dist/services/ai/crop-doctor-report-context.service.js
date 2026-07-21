import { supabase } from '../../lib/supabase.js';
import { blockService } from '../core/block.service.js';
import { plotLocationService } from '../core/plot-location.service.js';
import { soilReportLoaderService } from '../soil/soil-report-loader.service.js';
import { visitAiContextService } from '../core/visit-ai-context.service.js';
function formatDateShort(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime()))
        return iso.slice(0, 10);
    return d.toISOString().slice(0, 10);
}
function formatDaysAgo(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime()))
        return '';
    const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
    if (days === 0)
        return 'Today';
    if (days === 1)
        return '1 day ago';
    return `${days} days ago`;
}
function productNames(products) {
    if (!Array.isArray(products) || !products.length)
        return '';
    const names = products
        .map((p) => {
        if (typeof p === 'string')
            return p.trim();
        if (p && typeof p === 'object') {
            const row = p;
            return String(row.name ?? row.product ?? row.title ?? '').trim();
        }
        return '';
    })
        .filter(Boolean);
    return names.join(', ');
}
function activityLabel(row) {
    const custom = row.activity_label?.trim();
    if (custom)
        return custom;
    const products = productNames(row.products);
    if (products)
        return products;
    if (row.dosage_notes?.trim())
        return row.dosage_notes.trim();
    const type = String(row.activity_type ?? 'activity');
    if (type === 'spray_applied')
        return 'Foliar spray';
    if (type === 'fertigation')
        return 'Fertigation';
    if (type === 'drench')
        return 'Drench';
    return type.replace(/_/g, ' ');
}
function isFertilizerType(type, label) {
    const blob = `${type} ${label}`.toLowerCase();
    return /fertig|fertiliz|npk|urea|potash|manure|compost/.test(blob);
}
function isFoliarType(type, label) {
    if (type === 'spray_applied')
        return true;
    const blob = `${type} ${label}`.toLowerCase();
    return /foliar|spray|fungicide|insecticide|mancozeb|copper/.test(blob);
}
function isDrenchType(type, label) {
    if (type === 'drench')
        return true;
    return /drench/.test(`${type} ${label}`.toLowerCase());
}
function snapshotFromRow(row) {
    const appliedAt = String(row.applied_at ?? '');
    return {
        label: activityLabel(row),
        date: appliedAt ? formatDateShort(appliedAt) : undefined,
        daysAgo: appliedAt ? formatDaysAgo(appliedAt) : undefined,
    };
}
function formatLocation(params) {
    const village = params.village?.trim();
    const district = params.district?.trim();
    const pincode = params.pincode?.trim();
    const parts = [];
    if (village)
        parts.push(village);
    if (district) {
        parts.push(district);
        if (!district.toLowerCase().includes('kerala'))
            parts.push('Kerala');
    }
    if (parts.length)
        return parts.join(', ');
    if (district)
        return `${district}, Kerala`;
    if (pincode)
        return `PIN ${pincode}`;
    if (params.weatherLabel?.trim())
        return params.weatherLabel.trim();
    return undefined;
}
async function loadFieldActivities(farmerId, blockId) {
    let q = supabase
        .from('cultivation_activities')
        .select('applied_at, activity_type, activity_label, products, dosage_notes, farm_block_id, farmer_crop_id')
        .eq('farmer_id', farmerId)
        .order('applied_at', { ascending: false })
        .limit(40);
    const { data: rows } = await q;
    const scoped = (rows ?? []).filter((row) => {
        if (!blockId)
            return true;
        const bid = row.farm_block_id ? String(row.farm_block_id) : null;
        const cropId = row.farmer_crop_id ? String(row.farmer_crop_id) : null;
        if (!bid && !cropId)
            return true;
        return bid === blockId || cropId === blockId;
    });
    let lastFertilizer;
    let lastFoliarSpray;
    let lastDrench;
    for (const row of scoped) {
        const type = String(row.activity_type ?? '');
        const label = activityLabel(row);
        const snap = snapshotFromRow(row);
        if (!lastFertilizer && isFertilizerType(type, label))
            lastFertilizer = snap;
        if (!lastFoliarSpray && isFoliarType(type, label))
            lastFoliarSpray = snap;
        if (!lastDrench && isDrenchType(type, label))
            lastDrench = snap;
        if (lastFertilizer && lastFoliarSpray && lastDrench)
            break;
    }
    if (!lastFertilizer || !lastFoliarSpray || !lastDrench) {
        const { data: logs } = await supabase
            .from('interaction_logs')
            .select('field_activity_label, field_activity_date, summary, interaction_at')
            .eq('farmer_id', farmerId)
            .not('field_activity_label', 'is', null)
            .order('field_activity_date', { ascending: false, nullsFirst: false })
            .limit(15);
        for (const log of logs ?? []) {
            const label = String(log.field_activity_label ?? '').trim();
            if (!label)
                continue;
            const at = String(log.field_activity_date ?? log.interaction_at ?? '');
            const snap = {
                label,
                date: at ? formatDateShort(at) : undefined,
                daysAgo: at ? formatDaysAgo(at) : undefined,
            };
            if (!lastFertilizer && isFertilizerType('interaction', label))
                lastFertilizer = snap;
            if (!lastFoliarSpray && isFoliarType('interaction', label))
                lastFoliarSpray = snap;
            if (!lastDrench && isDrenchType('interaction', label))
                lastDrench = snap;
        }
    }
    return { lastFertilizer, lastFoliarSpray, lastDrench };
}
async function loadPreviousDiagnosis(farmerId, blockId, currentIssue) {
    const { data: recs } = blockId
        ? await supabase
            .from('recommendation_records')
            .select('issue_detected, recommendation_text, outcome, created_at')
            .eq('farmer_id', farmerId)
            .eq('block_id', blockId)
            .order('created_at', { ascending: false })
            .limit(5)
        : { data: null };
    const priorRec = (recs ?? []).find((r) => r.issue_detected &&
        (!currentIssue || !labelsSimilar(String(r.issue_detected), currentIssue))) ?? recs?.[0];
    if (priorRec) {
        const outcome = priorRec.outcome ? String(priorRec.outcome).toLowerCase() : '';
        let status;
        if (/recover|resolved|better/.test(outcome))
            status = 'Recovered';
        else if (/improv|partial/.test(outcome))
            status = 'Improving';
        else if (/same|unchanged/.test(outcome))
            status = 'Same';
        else if (/worse|spread/.test(outcome))
            status = 'Worse';
        else
            status = 'Unknown';
        return {
            previousDisease: priorRec.issue_detected ? String(priorRec.issue_detected) : undefined,
            previousRecommendation: priorRec.recommendation_text
                ? String(priorRec.recommendation_text).slice(0, 300)
                : undefined,
            previousDiagnosisStatus: status,
        };
    }
    const { data: history } = await supabase
        .from('disease_history')
        .select('issue_label, recorded_at, severity')
        .eq('farmer_id', farmerId)
        .order('recorded_at', { ascending: false })
        .limit(5);
    const priorIssue = (history ?? []).find((h) => h.issue_label && (!currentIssue || !labelsSimilar(String(h.issue_label), currentIssue)));
    return {
        previousDisease: priorIssue?.issue_label ? String(priorIssue.issue_label) : undefined,
        previousDiagnosisStatus: priorIssue ? 'Unknown' : undefined,
    };
}
function labelsSimilar(a, b) {
    const na = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return na === nb || na.includes(nb) || nb.includes(na);
}
function weatherFromVisitContext(weather) {
    if (!weather)
        return undefined;
    const totals = weather.totals7d;
    const pressures = weather.pressures;
    const alerts = Array.isArray(weather.diseaseAlerts) ? weather.diseaseAlerts.map(String) : [];
    const flags = [];
    if (alerts.includes('heavy_rain_likely'))
        flags.push('Heavy rain likely');
    if (alerts.includes('high_humidity_likely'))
        flags.push('High humidity');
    if (alerts.includes('high_heat_likely'))
        flags.push('High heat');
    return {
        temperature: weather.temperatureC != null
            ? `${Math.round(Number(weather.temperatureC))}°C`
            : totals?.avgTempC != null
                ? `${Math.round(totals.avgTempC)}°C`
                : undefined,
        humidity: weather.humidityPct != null
            ? `${Math.round(Number(weather.humidityPct))}%`
            : totals?.avgHumidityPct != null
                ? `${Math.round(totals.avgHumidityPct)}%`
                : undefined,
        rainfall7d: totals?.rainfallMm != null
            ? `${totals.rainfallMm} mm`
            : weather.rainfallMm != null
                ? `${weather.rainfallMm} mm`
                : undefined,
        weather: flags.length ? flags.join('; ') : undefined,
        soilMoisture: pressures?.waterlogging
            ? 'Wet, risk of temporary waterlogging'
            : undefined,
    };
}
function weatherFromContextPack(pack) {
    if (!pack)
        return undefined;
    const flags = [];
    if (pack.heavyRainLikely)
        flags.push('Heavy rain likely');
    if (pack.highHumidityLikely)
        flags.push('High humidity');
    if (pack.highHeatLikely)
        flags.push('High heat');
    return {
        temperature: pack.maxTempCToday != null ? `${Math.round(pack.maxTempCToday)}°C` : undefined,
        humidity: pack.avgHumidityPct != null ? `${Math.round(pack.avgHumidityPct)}%` : undefined,
        rainfall7d: pack.rainMmToday != null ? `${pack.rainMmToday} mm (today)` : undefined,
        weather: flags.length ? flags.join('; ') : pack.seasonPhase ? `${pack.seasonPhase} season` : undefined,
        soilMoisture: pack.drainageRisk === 'high'
            ? 'Wet, risk of temporary waterlogging'
            : pack.drainageRisk === 'moderate'
                ? 'Moist'
                : pack.drainageRisk === 'low'
                    ? 'Normal'
                    : undefined,
    };
}
export const cropDoctorReportContextService = {
    async build(params) {
        const blockId = params.blockId?.trim() || null;
        const block = blockId
            ? await blockService.getById(blockId, params.farmerId)
            : await blockService.getPrimaryBlock(params.farmerId);
        const resolvedBlockId = blockId ?? block?.id ?? null;
        const [{ data: farmer }, activities, previous, visitContext, weatherCoords, soilReport] = await Promise.all([
            supabase
                .from('farmers')
                .select('district, village, pincode_id, pincode_master(pincode, district, village)')
                .eq('id', params.farmerId)
                .maybeSingle(),
            loadFieldActivities(params.farmerId, resolvedBlockId ?? undefined),
            loadPreviousDiagnosis(params.farmerId, resolvedBlockId ?? undefined, params.currentIssue),
            resolvedBlockId
                ? visitAiContextService
                    .buildVisitAiContext({ farmerId: params.farmerId, blockId: resolvedBlockId })
                    .catch(() => null)
                : Promise.resolve(null),
            plotLocationService.resolveWeatherCoords(params.farmerId, resolvedBlockId).catch(() => null),
            soilReportLoaderService.loadLatestForBlock(params.farmerId, resolvedBlockId),
        ]);
        const pm = farmer?.pincode_master;
        const village = farmer?.village ? String(farmer.village) : pm?.village ?? params.contextPack?.village;
        const district = farmer?.district ? String(farmer.district) : pm?.district ?? params.contextPack?.district;
        const pincode = pm?.pincode ?? params.contextPack?.pincode;
        const weatherSnapshot = visitContext?.weatherSnapshot;
        const location = formatLocation({
            village,
            district,
            pincode,
            weatherLabel: weatherSnapshot?.locationLabel ? String(weatherSnapshot.locationLabel) : null,
        }) ?? weatherCoords?.label;
        const soilSummary = soilReport?.summaryLine ??
            params.contextPack?.soilLabSummary ??
            undefined;
        const visitWeather = weatherFromVisitContext(weatherSnapshot);
        const packWeather = weatherFromContextPack(params.contextPack);
        const weather = mergeWeather(visitWeather, packWeather);
        return {
            cropType: params.cropType ?? block?.crop_type,
            cropStage: params.cropStage ?? block?.stage ?? undefined,
            variety: block?.variety_name ?? undefined,
            dap: block?.dap ?? params.contextPack?.dap,
            location,
            plotLabel: params.plotLabel ?? block?.plot_label ?? block?.name ?? undefined,
            contextPack: params.contextPack,
            lastFertilizer: activities.lastFertilizer,
            lastFoliarSpray: activities.lastFoliarSpray,
            lastDrench: activities.lastDrench,
            previousDisease: previous.previousDisease,
            previousRecommendation: previous.previousRecommendation,
            previousDiagnosisStatus: previous.previousDiagnosisStatus,
            soilSummary,
            soilReportLines: soilReport?.reportLines,
            soilReportDate: soilReport?.reportedAt ? String(soilReport.reportedAt).slice(0, 10) : undefined,
            weather,
        };
    },
};
function mergeWeather(primary, fallback) {
    if (!primary && !fallback)
        return undefined;
    return {
        temperature: primary?.temperature ?? fallback?.temperature,
        humidity: primary?.humidity ?? fallback?.humidity,
        rainfall7d: primary?.rainfall7d ?? fallback?.rainfall7d,
        weather: primary?.weather ?? fallback?.weather,
        soilMoisture: primary?.soilMoisture ?? fallback?.soilMoisture,
    };
}
//# sourceMappingURL=crop-doctor-report-context.service.js.map