import type { VisionObservation } from '../../domain/maios-reasoning/vision-observation.types.js';
import type { PlantIdHealthResult } from '../ai/types.js';
import { hasPestSilverStreakEvidence } from './symptom-evidence-patterns.js';

function clampConfidence(n: number): number {
  return Math.max(0.5, Math.min(0.98, n));
}

function normalizeCrop(cropType?: string | null): 'ginger' | 'tomato' | 'banana' | 'coconut' | 'brinjal' | 'generic' {
  const c = (cropType ?? '').toLowerCase();
  if (c.includes('tomato')) return 'tomato';
  if (c.includes('banana')) return 'banana';
  if (c.includes('coconut')) return 'coconut';
  if (c.includes('brinjal') || c.includes('eggplant')) return 'brinjal';
  if (c.includes('ginger')) return 'ginger';
  return 'generic';
}

function pushFeature(
  out: VisionObservation[],
  feature: string,
  confidence: number,
  value = 'present'
): void {
  out.push({ feature, value, confidence: clampConfidence(confidence) });
}

function inferGingerFromText(t: string, conf: number): VisionObservation[] {
  const out: VisionObservation[] = [];
  if (/blast|pyricularia|spindle|diamond/.test(t)) {
    pushFeature(out, 'spindle_shape', conf);
    pushFeature(out, 'grey_center', conf * 0.88);
    if (/black|dot|speck|pycnid/.test(t)) pushFeature(out, 'black_dots', conf * 0.9);
  }
  if (/rot|pythium|rhizome|waterlog|foul/.test(t)) pushFeature(out, 'soft_rot', conf);
  if (hasPestSilverStreakEvidence(t, 'ginger')) pushFeature(out, 'silver_streak', conf);
  return out;
}

function inferTomatoFromText(t: string, conf: number): VisionObservation[] {
  const out: VisionObservation[] = [];
  if (/alternaria|early blight|target spot|concentric|ring/.test(t)) {
    pushFeature(out, 'concentric_rings', conf);
  }
  if (/late blight|phytophthora|water.?soak|greasy|infestans/.test(t)) {
    pushFeature(out, 'water_soaked', conf);
  }
  if (/yellow|chlorosis|pale/.test(t) && !/streak/.test(t)) {
    pushFeature(out, 'yellowing', conf * 0.85);
  }
  return out;
}

function inferBananaFromText(t: string, conf: number): VisionObservation[] {
  const out: VisionObservation[] = [];
  if (/sigatoka|mycosphaerella|leaf spot|yellow streak|parallel streak|streak/.test(t)) {
    pushFeature(out, 'yellow_streak', conf);
    if (/parallel|vein|streak/.test(t)) pushFeature(out, 'parallel_streak', conf * 0.92);
  }
  if (/panama|fusarium|wilt|collapse|splitting pseudostem/.test(t)) {
    pushFeature(out, 'wilt_collapse', conf);
  }
  if (/weevil|borer|bore hole|sawdust/.test(t)) {
    pushFeature(out, 'borer_hole', conf);
  }
  return out;
}

function inferCoconutFromText(t: string, conf: number): VisionObservation[] {
  const out: VisionObservation[] = [];
  if (/bud rot|spear rot|crown rot|phytophthora palm|foul smell/.test(t)) {
    pushFeature(out, 'bud_rot', conf);
  }
  if (/rhinoceros|beetle|chewed|bore hole|borer/.test(t)) {
    pushFeature(out, 'beetle_damage', conf);
  }
  if (/root wilt|wilt disease|flaccid frond/.test(t)) {
    pushFeature(out, 'wilt_collapse', conf);
  }
  if (/yellow|chlorosis|nutrient/.test(t)) pushFeature(out, 'yellowing', conf * 0.85);
  return out;
}

function inferBrinjalFromText(t: string, conf: number): VisionObservation[] {
  const out: VisionObservation[] = [];
  if (/bacterial wilt|ralstonia|sudden wilt/.test(t)) pushFeature(out, 'wilt_collapse', conf);
  if (/borer|leucinodes|shoot borer|fruit borer/.test(t)) pushFeature(out, 'borer_hole', conf);
  if (/alternaria|leaf spot|concentric|target/.test(t)) pushFeature(out, 'concentric_rings', conf);
  if (/yellow|chlorosis/.test(t)) pushFeature(out, 'yellowing', conf * 0.85);
  return out;
}

function inferGenericFromText(t: string, conf: number): VisionObservation[] {
  return [
    ...inferGingerFromText(t, conf),
    ...inferTomatoFromText(t, conf),
    ...inferBananaFromText(t, conf),
    ...inferCoconutFromText(t, conf),
    ...inferBrinjalFromText(t, conf),
  ];
}

/** Crop-aware structured feature extraction from vision labels and Plant.id disease names. */
export const plantIdVisionFeaturesService = {
  normalizeCrop,

  inferFromLabel(label: string, baseConfidence: number, cropType?: string | null): VisionObservation[] {
    const t = label.toLowerCase().trim();
    if (!t) return [];
    const conf = Math.max(0.55, Math.min(0.92, baseConfidence));
    const crop = normalizeCrop(cropType);

    switch (crop) {
      case 'tomato':
        return inferTomatoFromText(t, conf);
      case 'banana':
        return inferBananaFromText(t, conf);
      case 'coconut':
        return inferCoconutFromText(t, conf);
      case 'brinjal':
        return inferBrinjalFromText(t, conf);
      case 'ginger':
        return inferGingerFromText(t, conf);
      default:
        return inferGenericFromText(t, conf);
    }
  },

  inferFromObservationText(text: string, cropType?: string | null): VisionObservation[] {
    const t = text.toLowerCase();
    const crop = normalizeCrop(cropType);
    const conf = 0.76;

    switch (crop) {
      case 'tomato':
        return inferTomatoFromText(t, conf);
      case 'banana':
        return inferBananaFromText(t, conf);
      case 'coconut':
        return inferCoconutFromText(t, conf);
      case 'brinjal':
        return inferBrinjalFromText(t, conf);
      case 'ginger':
        return inferGingerFromText(t, conf);
      default:
        return inferGenericFromText(t, conf);
    }
  },

  inferFromPlantIdResult(
    result: PlantIdHealthResult | null | undefined,
    cropType?: string | null
  ): VisionObservation[] {
    if (!result?.diseases?.length) return [];
    const groups: VisionObservation[][] = [];
    for (const d of result.diseases) {
      if ((d.probability ?? 0) < 0.12) continue;
      groups.push(this.inferFromLabel(d.name, d.probability ?? 0.65, cropType));
    }
    return this.merge(...groups);
  },

  visionPromptFeatureList(cropType?: string | null): string {
    const crop = normalizeCrop(cropType);
    switch (crop) {
      case 'tomato':
        return 'concentric_rings|water_soaked|yellowing';
      case 'banana':
        return 'yellow_streak|parallel_streak|wilt_collapse|borer_hole';
      case 'coconut':
        return 'bud_rot|beetle_damage|wilt_collapse|yellowing';
      case 'brinjal':
        return 'wilt_collapse|borer_hole|concentric_rings|yellowing';
      case 'ginger':
        return 'spindle_shape|grey_center|black_dots|silver_streak|soft_rot';
      default:
        return 'spindle_shape|grey_center|black_dots|silver_streak|soft_rot|concentric_rings|water_soaked|yellow_streak|wilt_collapse|borer_hole|bud_rot|beetle_damage|yellowing';
    }
  },

  merge(...groups: VisionObservation[][]): VisionObservation[] {
    const byFeature = new Map<string, VisionObservation>();
    for (const group of groups) {
      for (const obs of group) {
        const key = obs.feature.toLowerCase();
        const existing = byFeature.get(key);
        if (!existing || obs.confidence > existing.confidence) {
          byFeature.set(key, obs);
        }
      }
    }
    return [...byFeature.values()];
  },

  resolve(params: {
    cropType?: string | null;
    label?: string | null;
    confidence?: number;
    structured?: unknown;
    plantIdResult?: PlantIdHealthResult | null;
    observationLines?: string[];
  }): VisionObservation[] {
    const groups: VisionObservation[][] = [];

    if (params.plantIdResult) {
      groups.push(this.inferFromPlantIdResult(params.plantIdResult, params.cropType));
    }

    if (params.observationLines?.length) {
      for (const line of params.observationLines) {
        groups.push(this.inferFromObservationText(line, params.cropType));
      }
    }

    if (params.structured) {
      groups.push(parseStructuredJson(params.structured));
    }

    return this.merge(...groups);
  },
};

function present(value: string): boolean {
  return /present|yes|visible|detected|true|positive/i.test(value.trim());
}

function parseStructuredJson(raw: unknown): VisionObservation[] {
  if (!raw || typeof raw !== 'object') return [];
  const obs = (raw as { observations?: unknown }).observations;
  if (!Array.isArray(obs)) return [];
  return obs
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const feature = String(r.feature ?? '').trim();
      const value = String(r.value ?? 'present').trim();
      const confidence = Number(r.confidence);
      if (!feature || !Number.isFinite(confidence)) return null;
      if (!present(value) && confidence < 0.55) return null;
      return {
        feature: feature.toLowerCase().replace(/\s+/g, '_'),
        value,
        confidence: clampConfidence(confidence),
      };
    })
    .filter((x): x is VisionObservation => x != null);
}
