import { soilMetricsToFlatRecord } from '../soil/soil-lab-metrics.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import { maiosReasoningPipelineService, } from './maios-reasoning-pipeline.service.js';
function weatherContextFromVisit(context) {
    const snap = context.weatherSnapshot;
    if (!snap)
        return undefined;
    const alerts = Array.isArray(snap.diseaseAlerts) ? snap.diseaseAlerts : [];
    return {
        weatherRiskScore: typeof snap.weatherRiskScore === 'number' ? snap.weatherRiskScore : undefined,
        heavyRainLikely: alerts.includes('heavy_rain_likely'),
        highHeatLikely: alerts.includes('high_heat_likely'),
        highHumidityLikely: alerts.includes('high_humidity_likely'),
        soilPh: (() => {
            const flat = soilMetricsToFlatRecord(context.soilTestSummary?.metrics);
            return flat.ph;
        })(),
    };
}
function visitPhotosToEvidence(photoCount, pack) {
    if (photoCount <= 0)
        return [];
    const slots = pack.photoSlots.slice(0, photoCount);
    return slots.map((slot, i) => ({
        slot: slot.id,
        status: 'captured',
        qualityScore: i === 0 ? 82 : 75,
    }));
}
function hypothesesToMaios(rows) {
    return rows.map((h) => ({
        label: h.label,
        probability: Math.round(h.confidence * 100),
        source: 'M1',
    }));
}
function estimateVisitEqs(photoCount, measurementCount) {
    return Math.min(85, 45 + photoCount * 12 + Math.min(measurementCount, 4) * 4);
}
/** When shadow mode is off, Bayesian posterior replaces LLM hypothesis ranking on visit path. */
export function applyBayesianToVisitHypotheses(hypotheses, reasoning) {
    if (!reasoning || reasoning.shadowMode || !hypotheses.length)
        return hypotheses;
    const byLabel = new Map(hypotheses.map((h) => [h.label.toLowerCase(), h]));
    const ranked = reasoning.posterior
        .filter((p) => p.label !== 'Unknown' && p.probability >= 0.05)
        .slice(0, 5)
        .map((p) => {
        const orig = byLabel.get(p.label.toLowerCase());
        return {
            ...(orig ?? {}),
            label: p.label,
            confidence: p.probability,
            rationale: orig?.rationale ?? `Bayesian posterior ${Math.round(p.probability * 100)}%`,
        };
    });
    return ranked.length ? ranked : hypotheses;
}
/** Adapters that run v17 reasoning from visit wizard and WhatsApp without replacing existing LLM paths. */
export const maiosReasoningAdapterService = {
    async fromVisit(input) {
        if (!maiosReasoningPipelineService.isEnabled())
            return null;
        const pack = await cropPackLoaderService.load(input.context.cropType);
        const photoCount = input.analyzePhotoCount ?? 0;
        const photos = visitPhotosToEvidence(photoCount, pack);
        const eqs = estimateVisitEqs(photoCount, input.context.measurements.length);
        return maiosReasoningPipelineService.run({
            cropType: input.context.cropType,
            pack,
            symptomsText: [input.issueName, input.observation].filter(Boolean).join(' — '),
            contextPack: weatherContextFromVisit(input.context),
            photos,
            hypotheses: hypothesesToMaios(input.hypotheses),
            eqs,
            maiosRoute: 'field_visit',
            escalationRecommended: false,
            visionLabel: input.imageSignal?.label ?? input.hypotheses[0]?.label,
            visionConfidence: input.imageSignal?.confidence ?? input.hypotheses[0]?.confidence,
            visionObservations: input.imageSignal?.observations,
            farmerAnswers: input.farmerAnswers,
            answeredQuestionIds: input.answeredQuestionIds,
            dap: input.context.dap,
        });
    },
    async fromWhatsApp(input) {
        if (!maiosReasoningPipelineService.isEnabled())
            return null;
        const pack = await cropPackLoaderService.load(input.cropType);
        return maiosReasoningPipelineService.run({
            cropType: input.cropType,
            pack,
            symptomsText: input.symptomsText,
            contextPack: input.contextPack,
            photos: input.photos,
            hypotheses: input.hypotheses,
            eqs: input.eqs,
            maiosRoute: input.maiosRoute ?? 'auto_recommend',
            escalationRecommended: input.escalationRecommended,
            visionLabel: input.visionLabel,
            visionConfidence: input.visionConfidence,
            farmerAnswers: input.farmerAnswers,
            answeredQuestionIds: input.answeredQuestionIds,
            visionObservations: input.visionObservations,
            dap: input.dap,
            harvestWithinDays: input.harvestWithinDays,
        });
    },
};
//# sourceMappingURL=maios-reasoning-adapter.service.js.map