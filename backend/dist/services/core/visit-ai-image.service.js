import { visitVisionObservationsService } from '../maios-reasoning/visit-vision-observations.service.js';
import { plantIdVisionFeaturesService } from '../maios-reasoning/plant-id-vision-features.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { plantIdProvider } from '../ai/providers/plantid.provider.js';
import { openaiVisionProvider } from '../ai/providers/openai.provider.js';
import { hashVisitImageBase64, lookupVisitImageDiagnosis, storeVisitImageDiagnosis, } from './visit-image-diagnosis-cache.service.js';
import { sortVisitPhotosForDiagnosis } from './visit-ai-image-anchor.js';
function topPlantIdLabel(result, cropType) {
    const diseases = result?.diseases ?? [];
    if (!diseases.length)
        return null;
    const top = [...diseases].sort((a, b) => b.probability - a.probability)[0];
    if (!top?.name)
        return null;
    const observations = plantIdVisionFeaturesService.inferFromPlantIdResult(result, cropType);
    return {
        label: top.name,
        confidence: clamp(top.probability),
        source: 'plant_id',
        photoCount: 1,
        observations: observations.length
            ? observations
            : visitVisionObservationsService.inferFromLabel(top.name, top.probability, cropType),
    };
}
function clamp(n) {
    return Math.max(0.05, Math.min(0.98, n));
}
function visionLabelFromAdvisory(advisory) {
    return String(advisory.probableIssue ?? advisory.label ?? '').trim();
}
async function analyzeOnePhoto(photo, ctx) {
    const mime = photo.mimeType ?? 'image/jpeg';
    const contentHash = hashVisitImageBase64(photo.dataBase64);
    try {
        const cached = await lookupVisitImageDiagnosis(contentHash, ctx?.cropType);
        if (cached?.label) {
            return { ...cached, photoCount: 1 };
        }
    }
    catch (err) {
        logger.warn({ err }, 'Visit image diagnosis cache lookup failed');
    }
    let signal = null;
    if (env.PLANT_ID_API_KEY) {
        try {
            const plant = await plantIdProvider.assessHealth({ imageBase64: photo.dataBase64 });
            signal = topPlantIdLabel(plant, ctx?.cropType);
        }
        catch (err) {
            logger.warn({ err }, 'Plant.id visit analyze failed');
        }
    }
    if (!signal && env.OPENAI_API_KEY) {
        try {
            const featureList = plantIdVisionFeaturesService.visionPromptFeatureList(ctx?.cropType);
            const advisory = await openaiVisionProvider.analyzeVision({
                imageBase64: photo.dataBase64,
                mimeType: mime,
                temperature: 0,
                systemPrompt: `Identify the most likely crop disease, pest, or nutrient problem visible in the photo. Reply JSON only: {"probableIssue":"...","confidence":0.0-1.0,"observations":[{"feature":"${featureList}","value":"present|absent","confidence":0.0-1.0}]}`,
                userPrompt: `Crop: ${ctx?.cropType ?? 'unknown'}, DAP: ${ctx?.dap ?? '?'}. What is the primary crop health issue visible in this field photo? List visible lesion features in observations when confident.`,
            });
            const label = visionLabelFromAdvisory(advisory);
            if (label) {
                const structuredObs = env.ENABLE_STRUCTURED_VISION !== false
                    ? visitVisionObservationsService.resolve({
                        label,
                        confidence: Number(advisory.confidence ?? 0.65),
                        structured: advisory,
                        cropType: ctx?.cropType,
                    })
                    : visitVisionObservationsService.inferFromLabel(label, Number(advisory.confidence ?? 0.65), ctx?.cropType);
                signal = {
                    label,
                    confidence: clamp(Number(advisory.confidence ?? 0.65)),
                    source: 'vision',
                    photoCount: 1,
                    observations: structuredObs,
                };
            }
        }
        catch (err) {
            logger.warn({ err }, 'Vision visit analyze failed');
        }
    }
    if (!signal)
        return null;
    if (!signal.observations?.length) {
        signal.observations = visitVisionObservationsService.inferFromLabel(signal.label, signal.confidence, ctx?.cropType);
    }
    try {
        await storeVisitImageDiagnosis(contentHash, ctx?.cropType, signal);
    }
    catch (err) {
        logger.warn({ err }, 'Visit image diagnosis cache store failed');
    }
    return signal;
}
/** Run issue + visit photos through Plant.id or vision; fuse when multiple (up to 8). */
export async function resolveVisitImagePredictions(photos, ctx) {
    const batch = sortVisitPhotosForDiagnosis((photos ?? []).filter((p) => p.dataBase64?.length > 100)).slice(0, 8);
    if (!batch.length)
        return null;
    const signals = [];
    const results = await Promise.all(batch.slice(0, 4).map((photo) => analyzeOnePhoto(photo, ctx)));
    for (const signal of results) {
        if (signal)
            signals.push(signal);
    }
    if (!signals.length)
        return null;
    if (signals.length === 1)
        return { ...signals[0], photoCount: batch.length };
    const byLabel = new Map();
    for (const s of signals) {
        const key = s.label.toLowerCase();
        const arr = byLabel.get(key) ?? [];
        arr.push(s.confidence);
        byLabel.set(key, arr);
    }
    let bestLabel = signals[0].label;
    let bestConf = 0;
    for (const [label, confs] of byLabel.entries()) {
        const avg = confs.reduce((a, b) => a + b, 0) / confs.length;
        const fused = clamp(avg + (confs.length > 1 ? 0.05 : 0));
        if (fused > bestConf) {
            bestConf = fused;
            bestLabel = signals.find((s) => s.label.toLowerCase() === label)?.label ?? label;
        }
    }
    return {
        label: bestLabel,
        confidence: bestConf,
        source: 'fusion',
        photoCount: batch.length,
        observations: visitVisionObservationsService.merge(...signals.map((s) => s.observations ??
            visitVisionObservationsService.inferFromLabel(s.label, s.confidence, ctx?.cropType))),
    };
}
//# sourceMappingURL=visit-ai-image.service.js.map