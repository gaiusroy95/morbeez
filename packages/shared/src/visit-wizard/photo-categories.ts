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

/**
 * Resolves the photo type for the next capture.
 * An explicit user selection (selectedTypes[0]) always wins; auto-suggest only when none chosen.
 */
export function resolveCapturePhotoType(params: {
  selectedTypes: string[];
  availableTypes: string[];
  existingPhotoTypes: string[];
  /** Dedicated capture type — takes priority over selectedTypes[0] when set. */
  captureType?: string;
}): string {
  const { selectedTypes, availableTypes, existingPhotoTypes, captureType } = params;
  const explicit = captureType?.trim() || selectedTypes[0]?.trim();
  if (explicit) return explicit;

  const hasField = existingPhotoTypes.some((p) => isFieldLevelPhotoType(p));
  const hasSymptom = existingPhotoTypes.some((p) => isSymptomPhotoType(p));

  if (!hasField) {
    return availableTypes.find((t) => isFieldLevelPhotoType(t)) ?? 'whole_field';
  }
  if (!hasSymptom) {
    return availableTypes.find((t) => isSymptomPhotoType(t)) ?? 'leaf';
  }
  return availableTypes[0] ?? 'whole_field';
}

/** Suggest the next capture tag after a photo is added (field before symptom). */
export function suggestNextCapturePhotoType(
  existingPhotoTypes: string[],
  availableTypes: string[]
): string {
  return resolveCapturePhotoType({
    selectedTypes: [],
    availableTypes,
    existingPhotoTypes,
  });
}

/** Map vision / WhatsApp classifier categories to a visit photo type for a crop. */
export function mapClassifierCategoryToVisitPhotoType(
  category: string,
  cropType: string,
  availableTypes: string[]
): string {
  const avail = new Set(availableTypes.map((t) => t.toLowerCase()));
  const pick = (...candidates: string[]) =>
    candidates.find((c) => avail.has(c.toLowerCase())) ?? availableTypes[0] ?? 'other';

  const cat = category.toLowerCase().replace(/\s+/g, '_');
  const crop = cropType.toLowerCase();

  if (cat === 'soil' || cat === 'root_soil' || cat === 'drainage') {
    return pick('drainage', 'soil', 'whole_field');
  }
  if (cat === 'root' || cat === 'rhizome') {
    if (/ginger|turmeric|yam|colocasia|taro|elephant/.test(crop)) return pick('rhizome', 'root');
    return pick('root', 'rhizome');
  }
  if (cat === 'insect' || cat === 'pest') return pick('pest');
  if (cat === 'disease' || cat === 'disease_symptom' || cat === 'disease_stress') {
    return pick('disease', 'leaf');
  }
  if (cat === 'crop_leaf' || cat === 'leaf' || cat === 'symptom') {
    if (/ginger|turmeric|yam|colocasia|taro|elephant/.test(crop)) {
      const hasLeaf = avail.has('leaf');
      const hasRhizome = avail.has('rhizome');
      if (hasLeaf && hasRhizome) return 'leaf';
    }
    return pick('leaf', 'disease', 'rhizome');
  }
  if (cat === 'whole_field' || cat === 'field' || cat === 'plot' || cat === 'wide') {
    return pick('whole_field', 'field_overview', 'field');
  }
  if (cat === 'plant' || cat === 'bush' || cat === 'palm' || cat === 'tree') {
    return pick('plant', 'bush', 'palm', 'pseudo_stem');
  }
  if (cat === 'stem' || cat === 'pseudo_stem' || cat === 'trunk') {
    return pick('stem', 'pseudo_stem', 'trunk');
  }
  if (cat === 'weed') return pick('other', 'whole_field');
  return pick('leaf', 'plant', 'whole_field', 'other');
}
