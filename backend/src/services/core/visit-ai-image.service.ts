import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { plantIdProvider } from '../ai/providers/plantid.provider.js';
import { openaiVisionProvider } from '../ai/providers/openai.provider.js';

export type VisitAnalyzePhotoInput = {
  dataBase64: string;
  mimeType?: string;
};

export type VisitImageSignal = {
  label: string;
  confidence: number;
  source: 'plant_id' | 'vision' | 'fusion';
  photoCount: number;
};

export type VisitImageContext = {
  cropType?: string;
  dap?: number | null;
  stage?: string | null;
};

function topPlantIdLabel(result: Awaited<ReturnType<typeof plantIdProvider.assessHealth>>): VisitImageSignal | null {
  const diseases = result?.diseases ?? [];
  if (!diseases.length) return null;
  const top = [...diseases].sort((a, b) => b.probability - a.probability)[0];
  if (!top?.name) return null;
  return {
    label: top.name,
    confidence: clamp(top.probability),
    source: 'plant_id',
    photoCount: 1,
  };
}

function clamp(n: number): number {
  return Math.max(0.05, Math.min(0.98, n));
}

async function analyzeOnePhoto(
  photo: VisitAnalyzePhotoInput,
  ctx?: VisitImageContext
): Promise<VisitImageSignal | null> {
  const mime = photo.mimeType ?? 'image/jpeg';
  if (env.PLANT_ID_API_KEY) {
    try {
      const plant = await plantIdProvider.assessHealth({ imageBase64: photo.dataBase64 });
      const signal = topPlantIdLabel(plant);
      if (signal) return signal;
    } catch (err) {
      logger.warn({ err }, 'Plant.id visit analyze failed');
    }
  }

  if (env.OPENAI_API_KEY) {
    try {
      const advisory = await openaiVisionProvider.analyzeVision({
        imageBase64: photo.dataBase64,
        mimeType: mime,
        systemPrompt:
          'Identify the most likely crop disease, pest, or nutrient problem. Reply JSON only: {"label":"...","confidence":0.0-1.0}',
        userPrompt: `Crop: ${ctx?.cropType ?? 'unknown'}, DAP: ${ctx?.dap ?? '?'}. What is the primary crop health issue visible in this field photo?`,
      });
      const label = String(advisory.probableIssue ?? '').trim();
      if (!label) return null;
      return {
        label,
        confidence: clamp(Number(advisory.confidence ?? 0.65)),
        source: 'vision',
        photoCount: 1,
      };
    } catch (err) {
      logger.warn({ err }, 'Vision visit analyze failed');
    }
  }

  return null;
}

/** Run issue + visit photos through Plant.id or vision; fuse when multiple (up to 8). */
export async function resolveVisitImagePredictions(
  photos: VisitAnalyzePhotoInput[] | undefined,
  ctx?: VisitImageContext
): Promise<VisitImageSignal | null> {
  const batch = (photos ?? []).filter((p) => p.dataBase64?.length > 100).slice(0, 8);
  if (!batch.length) return null;

  const signals: VisitImageSignal[] = [];
  const results = await Promise.all(batch.slice(0, 4).map((photo) => analyzeOnePhoto(photo, ctx)));
  for (const signal of results) {
    if (signal) signals.push(signal);
  }
  if (!signals.length) return null;
  if (signals.length === 1) return { ...signals[0]!, photoCount: batch.length };

  const byLabel = new Map<string, number[]>();
  for (const s of signals) {
    const key = s.label.toLowerCase();
    const arr = byLabel.get(key) ?? [];
    arr.push(s.confidence);
    byLabel.set(key, arr);
  }
  let bestLabel = signals[0]!.label;
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
