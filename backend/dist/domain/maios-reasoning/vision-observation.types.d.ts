/** Structured vision features for Domain 2 — fed into evidence repository, not LLM ranking. */
export type VisionObservation = {
    feature: string;
    value: string;
    confidence: number;
};
export declare const GINGER_VISION_FEATURES: readonly ["spindle_shape", "grey_center", "black_dots", "silver_streak", "soft_rot"];
export declare const TOMATO_VISION_FEATURES: readonly ["concentric_rings", "water_soaked", "yellowing"];
export declare const BANANA_VISION_FEATURES: readonly ["yellow_streak", "parallel_streak", "wilt_collapse", "borer_hole"];
export declare const COCONUT_VISION_FEATURES: readonly ["bud_rot", "beetle_damage", "wilt_collapse", "yellowing"];
export type GingerVisionFeature = (typeof GINGER_VISION_FEATURES)[number];
export type TomatoVisionFeature = (typeof TOMATO_VISION_FEATURES)[number];
export type BananaVisionFeature = (typeof BANANA_VISION_FEATURES)[number];
export type CoconutVisionFeature = (typeof COCONUT_VISION_FEATURES)[number];
export declare function visionFeaturesForCrop(cropType?: string | null): readonly string[];
//# sourceMappingURL=vision-observation.types.d.ts.map