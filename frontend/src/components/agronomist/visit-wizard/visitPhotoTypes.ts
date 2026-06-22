export type VisitPhotoTypeOption = {
  value: string;
  label: string;
  recommended?: boolean;
  /** Core evidence photos agronomists should capture first. */
  tier?: 'mandatory' | 'detail';
};

const COMMON = {
  wholeField: { value: 'whole_field', label: 'Whole field', recommended: true, tier: 'mandatory' as const },
  blockView: { value: 'block_view', label: 'Block view', tier: 'mandatory' as const },
  plant: { value: 'plant', label: 'Whole plant', recommended: true, tier: 'mandatory' as const },
  symptom: { value: 'disease', label: 'Symptom close-up', recommended: true, tier: 'mandatory' as const },
  leaf: { value: 'leaf', label: 'Leaf', tier: 'detail' as const },
  leafUnderside: { value: 'leaf_underside', label: 'Leaf underside', tier: 'detail' as const },
  pest: { value: 'pest', label: 'Pest signs', tier: 'detail' as const },
  disease: { value: 'disease', label: 'Disease', tier: 'detail' as const },
  stem: { value: 'stem', label: 'Stem base', tier: 'detail' as const },
  root: { value: 'root', label: 'Root / rhizome', tier: 'detail' as const },
  fruit: { value: 'fruit', label: 'Fruit', tier: 'detail' as const },
  flower: { value: 'flower', label: 'Flower', tier: 'detail' as const },
  irrigation: { value: 'irrigation', label: 'Irrigation source', tier: 'detail' as const },
  soil: { value: 'soil', label: 'Soil surface', tier: 'detail' as const },
  other: { value: 'other', label: 'Other', tier: 'detail' as const },
} as const;

const RHIZOME_TYPES: VisitPhotoTypeOption[] = [
  COMMON.wholeField,
  COMMON.blockView,
  { value: 'rhizome', label: 'Rhizome', recommended: true, tier: 'mandatory' },
  COMMON.plant,
  COMMON.symptom,
  COMMON.leaf,
  COMMON.leafUnderside,
  COMMON.pest,
  COMMON.stem,
  COMMON.root,
  { value: 'drainage', label: 'Drainage / soil', tier: 'detail' },
  COMMON.irrigation,
  COMMON.other,
];

const BANANA_TYPES: VisitPhotoTypeOption[] = [
  { value: 'whole_field', label: 'Whole plot', recommended: true },
  { value: 'pseudo_stem', label: 'Pseudo-stem', recommended: true },
  COMMON.leaf,
  { value: 'sucker', label: 'Sucker / plant' },
  { value: 'bunch', label: 'Bunch' },
  COMMON.pest,
  COMMON.disease,
  COMMON.other,
];

const SPICE_BUSH_TYPES: VisitPhotoTypeOption[] = [
  COMMON.wholeField,
  { value: 'bush', label: 'Bush / plant', recommended: true },
  COMMON.leaf,
  { value: 'panicle', label: 'Panicle / spike' },
  { value: 'berry', label: 'Berry / fruit' },
  COMMON.pest,
  COMMON.disease,
  COMMON.other,
];

const PLANTATION_TYPES: VisitPhotoTypeOption[] = [
  COMMON.wholeField,
  { value: 'palm', label: 'Palm / tree', recommended: true },
  COMMON.leaf,
  { value: 'trunk', label: 'Trunk / stem' },
  { value: 'nut', label: 'Nut / bunch' },
  COMMON.pest,
  COMMON.disease,
  COMMON.other,
];

const VEGETABLE_TYPES: VisitPhotoTypeOption[] = [
  COMMON.wholeField,
  COMMON.plant,
  COMMON.leaf,
  COMMON.flower,
  COMMON.fruit,
  COMMON.pest,
  COMMON.disease,
  COMMON.other,
];

const DEFAULT_TYPES: VisitPhotoTypeOption[] = [
  COMMON.wholeField,
  COMMON.plant,
  COMMON.leaf,
  COMMON.pest,
  COMMON.disease,
  COMMON.fruit,
  COMMON.stem,
  COMMON.other,
];

const RHIZOME_CROPS = new Set(['ginger', 'turmeric', 'elephant_foot_yam', 'colocasia', 'taro']);
const BANANA_CROPS = new Set(['banana', 'plantain']);
const SPICE_BUSH_CROPS = new Set(['pepper', 'black_pepper', 'cardamom', 'coffee', 'arecanut']);
const PLANTATION_CROPS = new Set(['coconut', 'oil_palm', 'rubber', 'cashew', 'mango', 'citrus']);
const VEGETABLE_CROPS = new Set([
  'tomato',
  'chilli',
  'chili',
  'brinjal',
  'eggplant',
  'cucumber',
  'beans',
  'cabbage',
  'okra',
  'onion',
  'potato',
  'vegetable',
  'vegetables',
]);

const CROP_OVERRIDES: Record<string, VisitPhotoTypeOption[]> = {
  ginger: RHIZOME_TYPES,
  turmeric: RHIZOME_TYPES,
  banana: BANANA_TYPES,
  pepper: SPICE_BUSH_TYPES,
  black_pepper: SPICE_BUSH_TYPES,
  cardamom: SPICE_BUSH_TYPES,
  coconut: PLANTATION_TYPES,
};

function normalizeCropKey(cropType: string): string {
  return cropType.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function getVisitPhotoTypesForCrop(cropType: string): VisitPhotoTypeOption[] {
  const key = normalizeCropKey(cropType);
  if (CROP_OVERRIDES[key]) return CROP_OVERRIDES[key]!;
  if (RHIZOME_CROPS.has(key)) return RHIZOME_TYPES;
  if (BANANA_CROPS.has(key)) return BANANA_TYPES;
  if (SPICE_BUSH_CROPS.has(key)) return SPICE_BUSH_TYPES;
  if (PLANTATION_CROPS.has(key)) return PLANTATION_TYPES;
  if (VEGETABLE_CROPS.has(key)) return VEGETABLE_TYPES;
  return DEFAULT_TYPES;
}

export function getDefaultSelectedPhotoTypes(cropType: string): string[] {
  const types = getVisitPhotoTypesForCrop(cropType);
  const recommended = types.filter((t) => t.recommended).map((t) => t.value);
  if (recommended.length) return recommended;
  return types[0] ? [types[0].value] : ['whole_field'];
}

export function getVisitPhotoTypeLabel(cropType: string, value: string): string {
  return getVisitPhotoTypesForCrop(cropType).find((t) => t.value === value)?.label ?? value;
}

export function formatCropPhotoGuidance(cropType: string): string {
  const crop = cropType.replace(/_/g, ' ').trim() || 'this crop';
  const mandatory = getMandatoryPhotoTypes(cropType).map((t) => t.label);
  if (!mandatory.length) {
    return `Capture field context and symptom close-ups for ${crop}.`;
  }
  return `Required evidence for ${crop}: ${mandatory.join(', ')}. Add detail shots as needed.`;
}

export function getMandatoryPhotoTypes(cropType: string): VisitPhotoTypeOption[] {
  const types = getVisitPhotoTypesForCrop(cropType);
  const mandatory = types.filter((t) => t.tier === 'mandatory' || t.recommended);
  return mandatory.length ? mandatory : types.slice(0, 4);
}

export function getDetailPhotoTypes(cropType: string): VisitPhotoTypeOption[] {
  const types = getVisitPhotoTypesForCrop(cropType);
  const mandatoryValues = new Set(getMandatoryPhotoTypes(cropType).map((t) => t.value));
  return types.filter((t) => !mandatoryValues.has(t.value));
}
