/**
 * Detect whether imageObservations actually show a usable crop / plant symptom photo.
 * Weather priors and empty captions must not count as photo evidence.
 */
const NO_CROP_RE = /\b(no\s+crop|no\s+plant|no\s+leaf|not\s+a\s+crop|crop\s+image\s+(not\s+)?provided|no\s+visible\s+crop|cannot\s+see\s+(the\s+)?crop|no\s+field\s+photo|blank\s+image|unrelated\s+(image|photo)|screenshot|selfie|document|label\s+only|bag\s+only|fertilizer\s+bag|product\s+label|no\s+plant\s+tissue)\b/i;
const USELESS_PHOTO_RE = /\b(too\s+blurry|out\s+of\s+focus|too\s+dark|cannot\s+assess|insufficient\s+(detail|evidence)|image\s+details?\s+are\s+limited|unclear\s+photo|not\s+clear\s+enough)\b/i;
export function observationIndicatesNoCrop(text) {
    return NO_CROP_RE.test(text.trim());
}
export function observationIndicatesUselessPhoto(text) {
    return USELESS_PHOTO_RE.test(text.trim());
}
export function hasUsableCropPhotoEvidence(observations) {
    const list = (observations ?? []).map((o) => o.trim()).filter(Boolean);
    if (!list.length)
        return false;
    const noCropHits = list.filter(observationIndicatesNoCrop).length;
    const usefulHits = list.filter((o) => !observationIndicatesNoCrop(o) && !observationIndicatesUselessPhoto(o)).length;
    // If most bullets say "no crop", treat as non-diagnostic photo.
    if (noCropHits > 0 && usefulHits === 0)
        return false;
    if (noCropHits >= usefulHits && noCropHits >= 1)
        return false;
    return usefulHits > 0;
}
/** Vision categories that must not enter Crop Doctor diagnosis. */
export const NON_DIAGNOSIS_VISION_CATEGORIES = new Set([
    'unknown_low_conf',
    'cultivation', // fertilizer bag / cultivation product photos
    'compatibility',
]);
export function isNonDiagnosisAgricultureCategory(category) {
    if (!category)
        return false;
    return NON_DIAGNOSIS_VISION_CATEGORIES.has(category);
}
//# sourceMappingURL=crop-photo-evidence.util.js.map