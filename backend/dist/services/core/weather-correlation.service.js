import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
function daysAgoIso(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}
function pct(part, total) {
    if (total <= 0)
        return 0;
    return Math.round((part / total) * 1000) / 10;
}
function rainfallBand(mm) {
    if (mm == null || Number.isNaN(mm) || mm <= 0)
        return 'dry';
    if (mm <= 10)
        return 'light';
    if (mm <= 30)
        return 'moderate';
    return 'heavy';
}
function isDiseaseFinding(type, issue) {
    if (type === 'disease' || type === 'pest' || type === 'weather_stress')
        return true;
    const t = (issue ?? '').toLowerCase();
    return (t.includes('blight') ||
        t.includes('rot') ||
        t.includes('rust') ||
        t.includes('pest') ||
        t.includes('disease'));
}
export const weatherCorrelationService = {
    async getAnalytics(days = 90) {
        const since = daysAgoIso(days);
        const [findingsRes, snapshotsRes, eventsRes, imagesRes, activitiesRes] = await Promise.all([
            supabase
                .from('crm_field_findings')
                .select(`id, finding_type, final_confirmed_issue, disease_pest, weather_snapshot_id, weather_context,
           weather_snapshots(rainfall_mm, rainfall_mm_forecast, humidity_pct, temperature_c, weather_risk_score, disease_alerts)`)
                .gte('visited_at', since)
                .is('archived_at', null),
            supabase
                .from('weather_snapshots')
                .select('id, event_type, rainfall_mm, humidity_pct, weather_risk_score', { count: 'exact' })
                .gte('captured_at', since),
            supabase
                .from('ai_training_events')
                .select('id, metadata', { count: 'exact' })
                .gte('reviewed_at', since),
            supabase
                .from('crop_images')
                .select('id, weather_snapshot_id', { count: 'exact' })
                .gte('created_at', since),
            supabase
                .from('cultivation_activities')
                .select('id, weather_snapshot_id', { count: 'exact' })
                .gte('applied_at', since),
        ]);
        throwIfSupabaseError(findingsRes.error, 'Could not load findings for weather analytics');
        throwIfSupabaseError(snapshotsRes.error, 'Could not load weather snapshots');
        throwIfSupabaseError(eventsRes.error, 'Could not load training events');
        throwIfSupabaseError(imagesRes.error, 'Could not load crop images');
        throwIfSupabaseError(activitiesRes.error, 'Could not load field activities');
        const findings = findingsRes.data ?? [];
        const bandTotals = {
            dry: { key: 'dry', label: 'Dry (0 mm)', findingCount: 0, diseaseCount: 0, pestCount: 0, weatherStressCount: 0, diseaseRatePct: 0 },
            light: { key: 'light', label: 'Light (1–10 mm)', findingCount: 0, diseaseCount: 0, pestCount: 0, weatherStressCount: 0, diseaseRatePct: 0 },
            moderate: { key: 'moderate', label: 'Moderate (10–30 mm)', findingCount: 0, diseaseCount: 0, pestCount: 0, weatherStressCount: 0, diseaseRatePct: 0 },
            heavy: { key: 'heavy', label: 'Heavy (>30 mm)', findingCount: 0, diseaseCount: 0, pestCount: 0, weatherStressCount: 0, diseaseRatePct: 0 },
        };
        let findingsWithWeather = 0;
        let highHumidityFindings = 0;
        let highHumidityDisease = 0;
        for (const f of findings) {
            const snapRaw = f.weather_snapshots;
            const snap = Array.isArray(snapRaw) ? snapRaw[0] : snapRaw;
            const rainfall = snap?.rainfall_mm != null
                ? Number(snap.rainfall_mm)
                : f.weather_context?.rainfall_mm;
            const humidity = snap?.humidity_pct != null ? Number(snap.humidity_pct) : null;
            const bandKey = rainfallBand(rainfall);
            const band = bandTotals[bandKey];
            if (!band)
                continue;
            if (f.weather_snapshot_id || snap)
                findingsWithWeather += 1;
            const findingType = f.finding_type ? String(f.finding_type) : null;
            const issue = f.final_confirmed_issue
                ? String(f.final_confirmed_issue)
                : f.disease_pest
                    ? String(f.disease_pest)
                    : null;
            band.findingCount += 1;
            if (findingType === 'disease')
                band.diseaseCount += 1;
            else if (findingType === 'pest')
                band.pestCount += 1;
            else if (findingType === 'weather_stress')
                band.weatherStressCount += 1;
            else if (isDiseaseFinding(findingType, issue))
                band.diseaseCount += 1;
            if (humidity != null && humidity >= 80) {
                highHumidityFindings += 1;
                if (isDiseaseFinding(findingType, issue))
                    highHumidityDisease += 1;
            }
        }
        const rainfallBands = Object.values(bandTotals).map((b) => ({
            ...b,
            diseaseRatePct: pct(b.diseaseCount + b.pestCount + b.weatherStressCount, b.findingCount),
        }));
        const heavyBand = bandTotals.heavy;
        const dryBand = bandTotals.dry;
        const heavyDiseaseRate = pct(heavyBand.diseaseCount + heavyBand.pestCount, heavyBand.findingCount);
        const dryDiseaseRate = pct(dryBand.diseaseCount + dryBand.pestCount, dryBand.findingCount);
        const eventsTotal = eventsRes.count ?? 0;
        let eventsWithWeather = 0;
        for (const e of eventsRes.data ?? []) {
            const meta = e.metadata ?? {};
            if (meta.weatherSnapshotId || meta.weatherContext)
                eventsWithWeather += 1;
        }
        const imagesTotal = imagesRes.count ?? 0;
        let imagesWithWeather = 0;
        for (const img of imagesRes.data ?? []) {
            if (img.weather_snapshot_id)
                imagesWithWeather += 1;
        }
        const activitiesTotal = activitiesRes.count ?? 0;
        let activitiesWithWeather = 0;
        for (const a of activitiesRes.data ?? []) {
            if (a.weather_snapshot_id)
                activitiesWithWeather += 1;
        }
        const insights = [];
        if (heavyBand.findingCount >= 3 && heavyDiseaseRate > dryDiseaseRate + 10) {
            insights.push(`Disease/pest findings are ${heavyDiseaseRate}% of field visits after heavy rain (>30 mm) vs ${dryDiseaseRate}% in dry conditions — prioritize scouting 3–5 days after rainfall.`);
        }
        if (highHumidityFindings >= 3 && highHumidityDisease > 0) {
            insights.push(`${pct(highHumidityDisease, highHumidityFindings)}% of high-humidity (≥80%) visits had disease/pest signals — fungal risk window is elevated.`);
        }
        if (findingsWithWeather < findings.length * 0.5 && findings.length > 0) {
            insights.push('Less than half of field findings have linked weather snapshots — capture is improving via operational sessions.');
        }
        if (insights.length === 0 && findings.length > 0) {
            insights.push('Collect more field findings with rainfall variation to strengthen disease–weather correlation models.');
        }
        const snapshotsByType = {};
        for (const s of snapshotsRes.data ?? []) {
            const t = String(s.event_type ?? 'manual');
            snapshotsByType[t] = (snapshotsByType[t] ?? 0) + 1;
        }
        return {
            periodDays: days,
            since,
            snapshotCount: snapshotsRes.count ?? 0,
            snapshotsByEventType: snapshotsByType,
            fieldFindingsAnalyzed: findings.length,
            findingsWithWeather,
            findingsWeatherCoveragePct: pct(findingsWithWeather, findings.length),
            rainfallBands,
            highHumidity: {
                visits: highHumidityFindings,
                diseaseSignals: highHumidityDisease,
                ratePct: pct(highHumidityDisease, highHumidityFindings),
            },
            postHeavyRain: {
                visits: heavyBand.findingCount,
                diseaseRatePct: heavyDiseaseRate,
                liftVsDryPct: Math.max(0, heavyDiseaseRate - dryDiseaseRate),
            },
            captureCoverage: {
                trainingEvents: { total: eventsTotal, withWeather: eventsWithWeather, pct: pct(eventsWithWeather, eventsTotal) },
                cropImages: { total: imagesTotal, withWeather: imagesWithWeather, pct: pct(imagesWithWeather, imagesTotal) },
                fieldActivities: {
                    total: activitiesTotal,
                    withWeather: activitiesWithWeather,
                    pct: pct(activitiesWithWeather, activitiesTotal),
                },
            },
            insights,
        };
    },
};
//# sourceMappingURL=weather-correlation.service.js.map