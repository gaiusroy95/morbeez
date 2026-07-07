/** Structured vision features for Domain 2 — fed into evidence repository, not LLM ranking. */
export type VisionObservation = {
  feature: string;
  value: string;
  confidence: number;
};

export const GINGER_VISION_FEATURES = [
  'spindle_shape',
  'grey_center',
  'black_dots',
  'silver_streak',
  'soft_rot',
] as const;

export const TOMATO_VISION_FEATURES = [
  'concentric_rings',
  'water_soaked',
  'yellowing',
] as const;

export const BANANA_VISION_FEATURES = [
  'yellow_streak',
  'parallel_streak',
  'wilt_collapse',
  'borer_hole',
] as const;

export const COCONUT_VISION_FEATURES = [
  'bud_rot',
  'beetle_damage',
  'wilt_collapse',
  'yellowing',
] as const;

export type GingerVisionFeature = (typeof GINGER_VISION_FEATURES)[number];
export type TomatoVisionFeature = (typeof TOMATO_VISION_FEATURES)[number];
export type BananaVisionFeature = (typeof BANANA_VISION_FEATURES)[number];
export type CoconutVisionFeature = (typeof COCONUT_VISION_FEATURES)[number];

export function visionFeaturesForCrop(cropType?: string | null): readonly string[] {
  const c = (cropType ?? '').toLowerCase();
  if (c.includes('tomato')) return TOMATO_VISION_FEATURES;
  if (c.includes('banana')) return BANANA_VISION_FEATURES;
  if (c.includes('coconut')) return COCONUT_VISION_FEATURES;
  if (c.includes('ginger')) return GINGER_VISION_FEATURES;
  return [...GINGER_VISION_FEATURES, ...TOMATO_VISION_FEATURES, ...BANANA_VISION_FEATURES, ...COCONUT_VISION_FEATURES];
}
