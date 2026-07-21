import { supabase } from '../../lib/supabase.js';
import { formatSoilMetricsForAi, soilDeficiencyFlags, soilMetricsToFlatRecord, } from '../soil/soil-lab-metrics.js';
import { plotDigitalTwinService } from '../intelligence/plot-digital-twin.service.js';
import { regionalThreatRadarService } from '../intelligence/regional-threat-radar.service.js';
function formatSoilBlock(soilTestSummary) {
    if (!soilTestSummary?.metrics)
        return 'No soil report on file';
    const formatted = formatSoilMetricsForAi(soilTestSummary.metrics, {
        reportedAt: soilTestSummary.reportedAt ? String(soilTestSummary.reportedAt) : null,
        labName: soilTestSummary.labName ? String(soilTestSummary.labName) : null,
        maxLines: 10,
    });
    if (!formatted)
        return 'No soil report on file';
    const deficiencies = soilDeficiencyFlags(soilTestSummary.metrics);
    const defLine = deficiencies.length ? `Deficiency flags: ${deficiencies.join(', ')}` : '';
    return [formatted, defLine].filter(Boolean).join('\n');
}
function formatWeatherBlock(weather) {
    if (!weather)
        return 'Weather unavailable';
    const w = weather;
    const lines = [
        `Today: temp ${w.temperatureC ?? '?'}°C, humidity ${w.humidityPct ?? '?'}%, rain ${w.rainfallMm ?? '?'}mm, risk ${w.weatherRiskScore ?? '?'}`,
    ];
    const last7 = w.last7Days;
    const totals = w.totals7d;
    if (last7?.length) {
        lines.push(`Last 7 days: total rain ${totals?.rainfallMm ?? '?'}mm, avg temp ${totals?.avgTempC ?? '?'}°C, avg humidity ${totals?.avgHumidityPct ?? '?'}%`);
        lines.push(`Daily pattern: ${last7
            .map((d) => `${String(d.date).slice(5)} ${d.rainfallMm}mm rain / ${d.temperatureC}°C / ${d.humidityPct}% RH`)
            .join('; ')}`);
    }
    const pressures = w.pressures;
    if (pressures?.irrigationTrend) {
        lines.push(`Irrigation trend: ${pressures.irrigationTrend}`);
    }
    const flags = [
        pressures?.heatStress && 'heat stress',
        pressures?.waterlogging && 'waterlogging risk',
        pressures?.fungalPressure && 'fungal pressure',
        pressures?.pestPressure && 'pest pressure',
    ].filter(Boolean);
    if (flags.length)
        lines.push(`7-day pressure flags: ${flags.join(', ')}`);
    return lines.join('\n');
}
function parseMeasurementValue(measurements, pattern) {
    const row = measurements.find((m) => pattern.test(m.key));
    if (!row?.value)
        return null;
    const n = parseFloat(row.value);
    return Number.isFinite(n) ? n : null;
}
export function computeEvidenceSignals(context, issueCategory, imageSignal) {
    const hints = [];
    const flat = soilMetricsToFlatRecord(context.soilTestSummary?.metrics);
    const n = flat.nitrogen ?? flat.N;
    const incidence = parseMeasurementValue(context.measurements, /incidence/i);
    const severity = parseMeasurementValue(context.measurements, /severity|damage/i);
    if (Number.isFinite(n) && n < 200) {
        hints.push({ signal: 'Low soil nitrogen', reason: `Soil N ${n} below typical threshold` });
    }
    if (incidence != null && incidence >= 30 && /disease|pest/.test(issueCategory)) {
        hints.push({
            signal: issueCategory.includes('pest') ? 'High pest incidence' : 'High disease incidence',
            reason: `Field incidence ${incidence}%`,
        });
    }
    if (severity != null && severity >= 50) {
        hints.push({ signal: 'Severe crop damage reported', reason: `Damage severity ${severity}%` });
    }
    if (context.blockAssessment?.blockHealth === 'need_assistance' ||
        context.blockAssessment?.cropPerformance === 'below_expectation') {
        hints.push({ signal: 'Poor block/crop assessment', reason: 'Agronomist flagged block stress' });
    }
    const weather = context.weatherSnapshot;
    const totals = weather?.totals7d;
    const pressures = weather?.pressures;
    if (/nutrient|deficien/.test(issueCategory) && totals?.rainfallMm != null && totals.rainfallMm >= 35) {
        hints.push({
            signal: 'Heavy 7-day rainfall',
            reason: `${totals.rainfallMm}mm may leach mobile nutrients (N, K)`,
        });
    }
    if (/nutrient|deficien/.test(issueCategory) && pressures?.heatStress) {
        hints.push({
            signal: 'Heat stress (7-day pattern)',
            reason: 'Elevated K demand and transpiration stress',
        });
    }
    if (/nutrient|deficien/.test(issueCategory) && pressures?.waterlogging) {
        hints.push({
            signal: 'Wet 7-day pattern',
            reason: 'Root oxygen stress; impaired K uptake likely',
        });
    }
    if (imageSignal && context.soilTestSummary && Number.isFinite(n) && n < 200) {
        const imgHay = imageSignal.label.toLowerCase();
        if (/yellow|chlorosis|deficien/.test(imgHay)) {
            hints.push({ signal: 'Yellowing/chlorosis in photos with low soil N', reason: 'Image + soil N align' });
        }
    }
    return hints;
}
/** @deprecated Context-only — do not use boost values for confidence mutation */
export function computeFusionHints(context, issueCategory, imageSignal) {
    return computeEvidenceSignals(context, issueCategory, imageSignal);
}
async function loadPriorVisitHistory(farmerId, blockId) {
    const { data: recs } = await supabase
        .from('recommendation_records')
        .select('issue_detected, outcome, recommendation_text, created_at')
        .eq('farmer_id', farmerId)
        .eq('block_id', blockId)
        .order('created_at', { ascending: false })
        .limit(3);
    if (!recs?.length)
        return 'No prior recommendations on this block';
    return recs
        .map((r) => `${r.issue_detected ?? 'issue'}: ${r.outcome ?? 'pending'} (${String(r.created_at).slice(0, 10)})`)
        .join('; ');
}
export const visitAiPromptContextService = {
    async buildPromptBlock(params) {
        const evidenceSignals = computeEvidenceSignals(params.context, params.issueCategory, params.imageSignal);
        const history = await loadPriorVisitHistory(params.context.farmerId, params.context.blockId);
        const plotTwin = await plotDigitalTwinService.getLatest(params.context.blockId);
        const plotMemory = plotDigitalTwinService.formatForPrompt(plotTwin);
        const regionalFlags = await regionalThreatRadarService
            .riskFlagsForFarmer(params.context.farmerId, params.context.cropType)
            .catch(() => []);
        const sections = [
            `=== CROP ===`,
            `Crop: ${params.context.cropType}, DAP: ${params.context.dap ?? '?'}, Stage: ${params.context.stage ?? '?'}`,
            `=== FIELD ASSESSMENT ===`,
            params.context.blockAssessment
                ? JSON.stringify(params.context.blockAssessment)
                : 'Not recorded',
            `=== MEASUREMENTS ===`,
            params.context.measurements.length
                ? params.context.measurements.map((m) => `${m.key}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`).join('; ')
                : 'None',
            `=== SOIL TEST ===`,
            formatSoilBlock(params.context.soilTestSummary),
            `=== WEATHER ===`,
            formatWeatherBlock(params.context.weatherSnapshot),
            `=== IMAGE SIGNAL ===`,
            params.imageSignal
                ? `${params.imageSignal.label} (${Math.round(params.imageSignal.confidence * 100)}%, ${params.imageSignal.source})`
                : 'None',
            `=== PRIOR VISITS ===`,
            history,
            `=== PLOT DIGITAL TWIN (context) ===`,
            plotMemory,
            ...(regionalFlags.length
                ? [`=== REGIONAL RISK FLAGS (context only) ===`, regionalFlags.join('\n')]
                : []),
            `=== ISSUE ===`,
            `Category: ${params.issueCategory}, Name: ${params.issueName}`,
            `Observation: ${params.observation ?? 'none'}`,
        ];
        if (params.qaAnswers?.length) {
            sections.push(`=== FOLLOW-UP Q&A ===`, params.qaAnswers.map((q) => `${q.question}: ${q.answer}`).join('; '));
        }
        if (params.similarCases?.length) {
            sections.push(`=== SIMILAR VERIFIED CASES ===`, params.similarCases
                .slice(0, 5)
                .map((c) => `${c.issueLabel}${c.outcome ? ` (outcome: ${c.outcome})` : ''}${c.expertDiagnosis ? ` expert: ${c.expertDiagnosis}` : ''}`)
                .join('; '));
        }
        if (params.trainingExamples?.length) {
            sections.push(`=== EXPERT CORRECTIONS (learn from these) ===`, params.trainingExamples
                .slice(0, 4)
                .map((e) => `AI said "${e.aiDiagnosis}" → expert "${e.expertDiagnosis}" (${e.reviewAction}, outcome ${e.outcome ?? 'unknown'})`)
                .join('\n'));
        }
        if (evidenceSignals.length) {
            sections.push(`=== EVIDENCE SIGNALS (context only — weigh with photos and measurements) ===`, evidenceSignals.map((h) => `${h.signal}: ${h.reason}`).join('; '));
        }
        return sections.join('\n');
    },
    formatSoilBlock,
    formatWeatherBlock,
    computeEvidenceSignals,
    computeFusionHints,
};
//# sourceMappingURL=visit-ai-prompt-context.service.js.map