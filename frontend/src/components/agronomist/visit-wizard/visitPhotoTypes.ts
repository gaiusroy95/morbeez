export type VisitPhotoTypeOption = {
  value: string;
  label: string;
  recommended?: boolean;
};

const COMMON = {
  wholeField: { value: 'whole_field', label: 'Whole field', recommended: true },
  plant: { value: 'plant', label: 'Plant' },
  leaf: { value: 'leaf', label: 'Leaf' },
  pest: { value: 'pest', label: 'Pest' },
  disease: { value: 'disease', label: 'Disease' },
  stem: { value: 'stem', label: 'Stem' },
  fruit: { value: 'fruit', label: 'Fruit' },
  flower: { value: 'flower', label: 'Flower' },
  other: { value: 'other', label: 'Other' },
} as const;

const RHIZOME_TYPES: VisitPhotoTypeOption[] = [
  COMMON.wholeField,
  { value: 'rhizome', label: 'Rhizome', recommended: true },
  COMMON.plant,
  COMMON.leaf,
  COMMON.pest,
  COMMON.disease,
  COMMON.stem,
  { value: 'drainage', label: 'Drainage / soil' },
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
  const types = getVisitPhotoTypesForCrop(cropType);
  const recommended = types.filter((t) => t.recommended).map((t) => t.label);
  if (!recommended.length) {
    return `Select photo types relevant to ${crop} before capture (optional).`;
  }
  return `Recommended for ${crop}: ${recommended.join(', ')}. Select types before capture (optional).`;
}
