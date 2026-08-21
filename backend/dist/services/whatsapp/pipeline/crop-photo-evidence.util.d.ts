/**
 * Detect whether imageObservations actually show a usable crop / plant symptom photo.
 * Weather priors and empty captions must not count as photo evidence.
 */
export declare function observationIndicatesNoCrop(text: string): boolean;
export declare function observationIndicatesUselessPhoto(text: string): boolean;
export declare function hasUsableCropPhotoEvidence(observations: string[] | null | undefined): boolean;
/** Vision categories that must not enter Crop Doctor diagnosis. */
export declare const NON_DIAGNOSIS_VISION_CATEGORIES: Set<string>;
export declare function isNonDiagnosisAgricultureCategory(category: string | null | undefined): boolean;
//# sourceMappingURL=crop-photo-evidence.util.d.ts.map