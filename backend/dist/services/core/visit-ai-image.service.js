import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { plantIdProvider } from '../ai/providers/plantid.provider.js';
import { openaiVisionProvider } from '../ai/providers/openai.provider.js';
function topPlantIdLabel(result) {
    const diseases = result?.diseases ?? [];
    if (!diseases.length)
        return null;
    const top = [...diseases].sort((a, b) => b.probability - a.probability)[0];
    if (!top?.name)
        return null;
    return {
        label: top.name,
        confidence: clamp(top.probability),
        source: 'plant_id',
        photoCount: 1,
    };
}
function clamp(n) {
    return Math.max(0.05, Math.min(0.98, n));
}
async function analyzeOnePhoto(photo, ctx) {
    const mime = photo.mimeType ?? 'image/jpeg';
    if (env.PLANT_ID_API_KEY) {
        try {
            const plant = await plantIdProvider.assessHealth({ imageBase64: photo.dataBase64 });
            const signal = topPlantIdLabel(plant);
            if (signal)
                return signal;
        }
        catch (err) {
            logger.warn({ err }, 'Plant.id visit analyze failed');
        }
    }
    if (env.OPENAI_API_KEY) {
        try {
            const advisory = await openaiVisionProvider.analyzeVision({
                imageBase64: photo.dataBase64,
                mimeType: mime,
                systemPrompt: 'Identify the most likely crop disease, pest, or nutrient problem. Reply JSON only: {"label":"...","confidence":0.0-1.0}',
                userPrompt: `Crop: ${ctx?.cropType ?? 'unknown'}, DAP: ${ctx?.dap ?? '?'}. What is the primary crop health issue visible in this field photo?`,
            });
            const label = String(advisory.probableIssue ?? '').trim();
            if (!label)
                return null;
            return {
                label,
                confidence: clamp(Number(advisory.confidence ?? 0.65)),
                source: 'vision',
                photoCount: 1,
            };
        }
        catch (err) {
            logger.warn({ err }, 'Vision visit analyze failed');
        }
    }
    return null;
}
/** Run issue + visit photos through Plant.id or vision; fuse when multiple (up to 8). */
export async function resolveVisitImagePredictions(photos, ctx) {
    const batch = (photos ?? []).filter((p) => p.dataBase64?.length > 100).slice(0, 8);
    if (!batch.length)
        return null;
    const signals = [];
    for (const photo of batch.slice(0, 4)) {
        const signal = await analyzeOnePhoto(photo, ctx);
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
    };
}
//# sourceMappingURL=visit-ai-image.service.js.map