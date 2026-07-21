export const GINGER_VISION_FEATURES = [
    'spindle_shape',
    'grey_center',
    'black_dots',
    'silver_streak',
    'soft_rot',
];
export const TOMATO_VISION_FEATURES = [
    'concentric_rings',
    'water_soaked',
    'yellowing',
];
export const BANANA_VISION_FEATURES = [
    'yellow_streak',
    'parallel_streak',
    'wilt_collapse',
    'borer_hole',
];
export const COCONUT_VISION_FEATURES = [
    'bud_rot',
    'beetle_damage',
    'wilt_collapse',
    'yellowing',
];
export function visionFeaturesForCrop(cropType) {
    const c = (cropType ?? '').toLowerCase();
    if (c.includes('tomato'))
        return TOMATO_VISION_FEATURES;
    if (c.includes('banana'))
        return BANANA_VISION_FEATURES;
    if (c.includes('coconut'))
        return COCONUT_VISION_FEATURES;
    if (c.includes('ginger'))
        return GINGER_VISION_FEATURES;
    return [...GINGER_VISION_FEATURES, ...TOMATO_VISION_FEATURES, ...BANANA_VISION_FEATURES, ...COCONUT_VISION_FEATURES];
}
//# sourceMappingURL=vision-observation.types.js.map