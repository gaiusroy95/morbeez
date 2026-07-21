import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { openaiVisionProvider } from './providers/openai.provider.js';
import { formatPlantIdSummary, plantIdProvider } from './providers/plantid.provider.js';
function clamp(n) {
    return Math.max(0.05, Math.min(0.98, n));
}
function normalizeLabel(label) {
    return label.trim().toLowerCase().replace(/\s+/g, ' ');
}
/** Pure fusion of per-image labels — exported for unit tests. */
export function fusePerImageSignals(signals, totalCount) {
    if (!signals.length) {
        return {
            fusedLabel: '',
            fusedConfidence: 0,
            evidenceBlock: '',
            analyzedCount: 0,
            totalCount,
        };
    }
    if (signals.length === 1) {
        const only = signals[0];
        const evidenceBlock = [
            `MULTI-IMAGE PER-PHOTO ANALYSIS (${totalCount} photo${totalCount === 1 ? '' : 's'}):`,
            `Photo ${only.index + 1}: ${only.label} (${(only.confidence * 100).toFixed(0)}%, ${only.source})` +
                (only.observations.length ? ` — ${only.observations.slice(0, 3).join('; ')}` : ''),
            'Use this photo analysis as the primary visual evidence.',
        ].join('\n');
        return {
            fusedLabel: only.label,
            fusedConfidence: only.confidence,
            evidenceBlock,
            analyzedCount: 1,
            totalCount,
        };
    }
    const byLabel = new Map();
    for (const s of signals) {
        const key = normalizeLabel(s.label);
        const cur = byLabel.get(key) ?? { label: s.label, confs: [], count: 0 };
        cur.confs.push(s.confidence);
        cur.count += 1;
        byLabel.set(key, cur);
    }
    let fusedLabel = signals[0].label;
    let fusedConfidence = 0;
    let bestCount = 0;
    for (const entry of byLabel.values()) {
        const avg = entry.confs.reduce((a, b) => a + b, 0) / entry.confs.length;
        // Agreement bonus: more photos agreeing → higher fused confidence
        const agreementBonus = Math.min(0.12, (entry.count - 1) * 0.04);
        const fused = clamp(avg + agreementBonus);
        // Majority vote first; confidence is a tiebreaker among equal counts
        if (entry.count > bestCount ||
            (entry.count === bestCount && fused > fusedConfidence)) {
            bestCount = entry.count;
            fusedConfidence = fused;
            fusedLabel = entry.label;
        }
    }
    const lines = signals.map((s) => {
        const obs = s.observations.length ? ` — ${s.observations.slice(0, 3).join('; ')}` : '';
        return `Photo ${s.index + 1}: ${s.label} (${(s.confidence * 100).toFixed(0)}%, ${s.source})${obs}`;
    });
    const evidenceBlock = [
        `MULTI-IMAGE PER-PHOTO ANALYSIS (${signals.length} of ${totalCount} photos analyzed individually, then fused):`,
        ...lines,
        `Fused primary signal: ${fusedLabel} (confidence ${(fusedConfidence * 100).toFixed(0)}% from label voting across photos).`,
        'You MUST reconcile ALL photos into one comprehensive diagnosis.',
        'Prefer the fused primary signal unless a minority photo clearly shows a different issue that changes treatment.',
        'In imageObservations, note what each photo angle shows and any disagreements between photos.',
        'probableIssue must reflect the combined evidence, not only the first photo.',
    ].join('\n');
    return {
        fusedLabel,
        fusedConfidence,
        evidenceBlock,
        analyzedCount: signals.length,
        totalCount,
    };
}
function pickBestPlantId(signals) {
    let best = null;
    let bestProb = -1;
    for (const s of signals) {
        const top = s.plantIdResult?.diseases?.[0];
        if (!top)
            continue;
        if (top.probability > bestProb) {
            bestProb = top.probability;
            best = s.plantIdResult ?? null;
        }
    }
    return best;
}
async function analyzeOneImage(image, index, ctx) {
    let plantIdResult = null;
    let plantLabel = null;
    let plantConf = 0;
    if (env.PLANT_ID_API_KEY) {
        try {
            plantIdResult = await plantIdProvider.assessHealth({ imageBase64: image.imageBase64 });
            const top = plantIdResult.diseases?.[0];
            if (top?.name && top.probability >= 0.15) {
                plantLabel = top.name;
                plantConf = clamp(top.probability);
            }
        }
        catch (err) {
            logger.warn({ err, index }, 'Multi-image Plant.id failed for one photo');
        }
    }
    let visionLabel = null;
    let visionConf = 0;
    let observations = [];
    if (env.OPENAI_API_KEY) {
        try {
            const advisory = await openaiVisionProvider.analyzeVision({
                imageBase64: image.imageBase64,
                mimeType: image.imageMimeType || 'image/jpeg',
                temperature: 0,
                systemPrompt: 'You are a crop disease scout. Analyze ONLY this single field photo. Reply JSON only: {"probableIssue":"...","confidence":0.0-1.0,"imageObservations":["specific visible feature 1","feature 2"]}',
                userPrompt: [
                    `Crop: ${ctx?.cropType ?? 'unknown'}`,
                    ctx?.cropStage ? `Stage: ${ctx.cropStage}` : null,
                    ctx?.dap != null ? `DAP: ${ctx.dap}` : null,
                    'What is the primary crop health issue visible in THIS photo?',
                    'List 2–4 concrete visual observations (colour, lesion pattern, leaf age, spread).',
                    'Do not invent issues that are not visible.',
                ]
                    .filter(Boolean)
                    .join('\n'),
            });
            const label = String(advisory.probableIssue ?? '').trim();
            if (label) {
                visionLabel = label;
                visionConf = clamp(Number(advisory.confidence ?? 0.65));
                observations = (advisory.imageObservations ?? [])
                    .map((o) => String(o).trim())
                    .filter(Boolean)
                    .slice(0, 5);
            }
        }
        catch (err) {
            logger.warn({ err, index }, 'Multi-image vision failed for one photo');
        }
    }
    if (!plantLabel && !visionLabel)
        return null;
    // Prefer vision label when both exist; boost confidence when they roughly agree
    let label = visionLabel ?? plantLabel;
    let confidence = visionLabel ? visionConf : plantConf;
    let source = visionLabel && plantLabel ? 'both' : visionLabel ? 'vision' : 'plant_id';
    if (visionLabel && plantLabel) {
        const agree = normalizeLabel(visionLabel).includes(normalizeLabel(plantLabel).slice(0, 12)) ||
            normalizeLabel(plantLabel).includes(normalizeLabel(visionLabel).slice(0, 12));
        if (agree) {
            confidence = clamp(Math.max(visionConf, plantConf) + 0.05);
        }
        else if (plantConf > visionConf + 0.2) {
            label = plantLabel;
            confidence = plantConf;
        }
    }
    return {
        index,
        label,
        confidence,
        observations,
        source,
        plantIdResult,
    };
}
async function mapInChunks(items, chunkSize, fn) {
    const out = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map((item, j) => fn(item, i + j)));
        out.push(...results);
    }
    return out;
}
/**
 * Analyze each diagnosis photo individually (Plant.id + focused vision),
 * then fuse labels into one evidence block for the final Crop Doctor call.
 */
export async function analyzeAndFuseDiagnosisImages(images, ctx) {
    const batch = images.filter((img) => img.imageBase64?.length > 100).slice(0, 8);
    if (batch.length <= 1)
        return null;
    logger.info({ photoCount: batch.length, cropType: ctx?.cropType }, 'Multi-image diagnosis: analyzing each photo then fusing');
    const results = await mapInChunks(batch, 4, (img, index) => analyzeOneImage(img, index, ctx));
    const signals = results.filter((s) => Boolean(s));
    if (!signals.length) {
        logger.warn({ photoCount: batch.length }, 'Multi-image diagnosis: no per-photo signals');
        return null;
    }
    const fused = fusePerImageSignals(signals, batch.length);
    const primaryPlantIdResult = pickBestPlantId(signals);
    const plantIdSummary = primaryPlantIdResult
        ? [
            formatPlantIdSummary(primaryPlantIdResult),
            signals.length > 1
                ? `(Plant.id ran on ${signals.filter((s) => s.plantIdResult).length} of ${batch.length} photos; showing strongest signal.)`
                : null,
        ]
            .filter(Boolean)
            .join(' ')
        : undefined;
    return {
        perImage: signals,
        fusedLabel: fused.fusedLabel,
        fusedConfidence: fused.fusedConfidence,
        evidenceBlock: fused.evidenceBlock,
        primaryPlantIdResult,
        plantIdSummary,
        analyzedCount: fused.analyzedCount,
        totalCount: fused.totalCount,
    };
}
/** Collect unique base64 images from DiagnoseInput-shaped fields. */
export function collectDiagnosisImages(input) {
    const out = [];
    const seen = new Set();
    const push = (img) => {
        const key = img.imageStoragePath ?? img.imageBase64.slice(0, 64);
        if (seen.has(key))
            return;
        seen.add(key);
        out.push(img);
    };
    if (input.imageBase64 && input.imageMimeType) {
        push({
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            imageStoragePath: input.imageStoragePath,
        });
    }
    for (const img of input.diagnosisImages ?? []) {
        if (!img.imageBase64)
            continue;
        push({
            imageBase64: img.imageBase64,
            imageMimeType: img.imageMimeType || 'image/jpeg',
            imageStoragePath: img.imageStoragePath,
        });
    }
    return out;
}
//# sourceMappingURL=multi-image-diagnosis.service.js.map