import { supabase } from '../../lib/supabase.js';
function formatSoilBlock(soilTestSummary) {
    if (!soilTestSummary?.metrics)
        return 'No soil report on file';
    const metrics = soilTestSummary.metrics;
    const lines = Object.entries(metrics).map(([k, v]) => `${k}: ${String(v)}`);
    const deficiencies = [];
    const n = Number(metrics.nitrogen ?? metrics.N ?? metrics.n);
    const p = Number(metrics.phosphorus ?? metrics.P ?? metrics.p);
    const k = Number(metrics.potassium ?? metrics.K ?? metrics.k);
    const ph = Number(metrics.ph ?? metrics.pH);
    if (Number.isFinite(n) && n < 200)
        deficiencies.push('low nitrogen');
    if (Number.isFinite(p) && p < 15)
        deficiencies.push('low phosphorus');
    if (Number.isFinite(k) && k < 100)
        deficiencies.push('low potassium');
    if (Number.isFinite(ph) && (ph < 5.5 || ph > 7.5))
        deficiencies.push('suboptimal pH');
    const defLine = deficiencies.length ? `Deficiency flags: ${deficiencies.join(', ')}` : '';
    return [lines.join('; '), defLine].filter(Boolean).join('\n');
}
function formatWeatherBlock(weather) {
    if (!weather)
        return 'Weather unavailable';
    const w = weather;
    return `Temp ${w.temperatureC ?? '?'}°C, humidity ${w.humidityPct ?? '?'}%, rain ${w.rainfallMm ?? '?'}mm, risk ${w.weatherRiskScore ?? '?'}`;
}
function parseMeasurementValue(measurements, pattern) {
    const row = measurements.find((m) => pattern.test(m.key));
    if (!row?.value)
        return null;
    const n = parseFloat(row.value);
    return Number.isFinite(n) ? n : null;
}
export function computeFusionHints(context, issueCategory, imageSignal) {
    const hints = [];
    const metrics = (context.soilTestSummary?.metrics ?? {});
    const n = Number(metrics.nitrogen ?? metrics.N ?? metrics.n);
    const incidence = parseMeasurementValue(context.measurements, /incidence/i);
    const severity = parseMeasurementValue(context.measurements, /severity|damage/i);
    if (Number.isFinite(n) && n < 200) {
        hints.push({ label: 'Nitrogen Deficiency', boost: 0.12, reason: `Soil N ${n} below typical threshold` });
    }
    if (incidence != null && incidence >= 30 && /disease|pest/.test(issueCategory)) {
        hints.push({
            label: issueCategory.includes('pest') ? 'Pest infestation' : 'Disease outbreak',
            boost: 0.1,
            reason: `Field incidence ${incidence}%`,
        });
    }
    if (severity != null && severity >= 50) {
        hints.push({ label: 'Severe crop damage', boost: 0.08, reason: `Damage severity ${severity}%` });
    }
    if (context.blockAssessment?.blockHealth === 'need_assistance' ||
        context.blockAssessment?.cropPerformance === 'below_expectation') {
        hints.push({ label: 'Stress-related disorder', boost: 0.06, reason: 'Poor block/crop assessment' });
    }
    if (imageSignal && context.soilTestSummary && Number.isFinite(n) && n < 200) {
        const imgHay = imageSignal.label.toLowerCase();
        if (/yellow|chlorosis|deficien/.test(imgHay)) {
            hints.push({ label: 'Nitrogen Deficiency', boost: 0.15, reason: 'Image + soil N align' });
        }
    }
    return hints;
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
        const fusionHints = computeFusionHints(params.context, params.issueCategory, params.imageSignal);
        const history = await loadPriorVisitHistory(params.context.farmerId, params.context.blockId);
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
        if (fusionHints.length) {
            sections.push(`=== RULE-BASED SIGNALS ===`, fusionHints.map((h) => `Boost "${h.label}" +${h.boost}: ${h.reason}`).join('; '));
        }
        return sections.join('\n');
    },
    formatSoilBlock,
    formatWeatherBlock,
    computeFusionHints,
};
//# sourceMappingURL=visit-ai-prompt-context.service.js.map