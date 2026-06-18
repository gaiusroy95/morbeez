/** Photo types that satisfy the wizard "field-level" minimum (plot / crop overview). */
const FIELD_PHOTO_TYPES = new Set([
  'whole_field',
  'field_overview',
  'field',
  'plant',
  'bush',
  'palm',
  'drainage',
]);

/** Photo types that satisfy the wizard "symptom close-up" minimum. */
const SYMPTOM_PHOTO_TYPES = new Set([
  'leaf',
  'leaf_closeup',
  'disease',
  'pest',
  'symptom',
  'stem',
  'fruit',
  'root',
  'rhizome',
  'pseudo_stem',
  'sucker',
  'bunch',
  'panicle',
  'berry',
  'trunk',
  'nut',
  'flower',
]);

export function isFieldLevelPhotoType(photoType: string | undefined | null): boolean {
  const key = String(photoType ?? '').trim().toLowerCase();
  if (!key) return false;
  if (FIELD_PHOTO_TYPES.has(key)) return true;
  if (/whole|field|plot|overview|drainage/.test(key)) return true;
  return false;
}

export function isSymptomPhotoType(photoType: string | undefined | null): boolean {
  const key = String(photoType ?? '').trim().toLowerCase();
  if (!key) return false;
  if (SYMPTOM_PHOTO_TYPES.has(key)) return true;
  if (/leaf|disease|pest|symptom|rhizome|stem|fruit|root|spot|close/.test(key)) return true;
  return false;
}

export function photoRequirementHint(photoTypes: string[]): string {
  const fieldLabels = photoTypes.filter((t) => isFieldLevelPhotoType(t));
  const symptomLabels = photoTypes.filter((t) => isSymptomPhotoType(t));
  const fieldHint = fieldLabels.length
    ? `Field: ${fieldLabels.slice(0, 3).join(', ')}`
    : 'Field: Whole field (or Plant)';
  const symptomHint = symptomLabels.length
    ? `Symptom: ${symptomLabels.slice(0, 3).join(', ')}`
    : 'Symptom: Leaf, Disease, or Rhizome close-up';
  return `Need one ${fieldHint} photo and one ${symptomHint} photo.`;
}
