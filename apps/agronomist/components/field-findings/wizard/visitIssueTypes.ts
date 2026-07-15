import { ISSUE_CATEGORIES, type IssueCategory } from '@morbeez/shared';

export const ISSUE_CATEGORY_OPTIONS: Array<{ value: IssueCategory; label: string }> = [
  { value: 'disease', label: 'Disease' },
  { value: 'pest', label: 'Pest' },
  { value: 'nutrient_deficiency', label: 'Nutrient deficiency' },
  { value: 'nutrient_toxicity', label: 'Nutrient toxicity' },
  { value: 'water_stress', label: 'Water stress' },
  { value: 'environmental_stress', label: 'Environmental stress' },
  { value: 'soil_problem', label: 'Soil problem' },
  { value: 'growth_issue', label: 'Growth issue' },
  { value: 'chemical_injury', label: 'Chemical injury' },
  { value: 'mechanical_damage', label: 'Mechanical damage' },
  { value: 'weed', label: 'Weed' },
  { value: 'other', label: 'Other' },
];

export const ISSUE_CATEGORY_LABELS = Object.fromEntries(
  ISSUE_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<IssueCategory, string>;

const GLOBAL_FALLBACKS: Record<IssueCategory, string[]> = {
  disease: ['Leaf Spot', 'Rhizome Rot', 'Soft Rot', 'Bacterial Wilt'],
  pest: ['Thrips', 'Shoot Borer', 'Rhizome Scale', 'Nematode'],
  nutrient_deficiency: [
    'Iron (Fe) deficiency',
    'Zinc (Zn) deficiency',
    'Magnesium (Mg) deficiency',
    'Nitrogen (N) deficiency',
    'Calcium (Ca) deficiency',
    'Phosphorus (P) deficiency',
    'Potassium (K) deficiency',
  ],
  nutrient_toxicity: ['Boron toxicity', 'Salt injury'],
  water_stress: ['Drought stress', 'Waterlogging', 'Moisture stress'],
  environmental_stress: ['Heat stress', 'Cold injury', 'Sun scald'],
  soil_problem: ['Poor drainage', 'Compaction', 'Low organic matter'],
  growth_issue: ['Stunted growth', 'Poor tillering'],
  chemical_injury: ['Herbicide drift', 'Fertilizer burn'],
  mechanical_damage: ['Tractor damage', 'Harvest injury'],
  weed: ['Broadleaf weeds', 'Grassy weeds', 'Sedge'],
  other: ['General observation'],
};

const CROP_ISSUE_FALLBACKS: Record<string, Partial<Record<IssueCategory, string[]>>> = {
  ginger: {
    disease: ['Rhizome Rot', 'Soft Rot', 'Leaf Spot', 'Bacterial Wilt', 'Anthracnose'],
    pest: ['Thrips', 'Shoot Borer', 'Rhizome Scale'],
    nutrient_deficiency: [
      'Iron (Fe) deficiency',
      'Zinc (Zn) deficiency',
      'Magnesium (Mg) deficiency',
      'Nitrogen (N) deficiency',
      'Calcium (Ca) deficiency',
      'Potassium (K) deficiency',
    ],
    water_stress: ['Drought stress', 'Waterlogging'],
    environmental_stress: ['Heat stress'],
    soil_problem: ['Poor drainage'],
  },
  turmeric: {
    disease: ['Rhizome Rot', 'Leaf Spot', 'Leaf Blight'],
    pest: ['Rhizome Scale', 'Shoot Borer', 'Thrips'],
    nutrient_deficiency: ['Zinc', 'Boron', 'Nitrogen'],
    water_stress: ['Drought stress', 'Waterlogging'],
  },
  banana: {
    disease: ['Sigatoka', 'Panama disease', 'Bunchy top'],
    pest: ['Aphid', 'Weevil', 'Nematode'],
    nutrient_deficiency: ['Potassium', 'Magnesium', 'Iron'],
    water_stress: ['Drought stress', 'Waterlogging'],
  },
  pepper: {
    disease: ['Anthracnose', 'Quick wilt', 'Pollu disease'],
    pest: ['Pollu beetle', 'Scale insect', 'Thrips'],
    nutrient_deficiency: ['Magnesium', 'Zinc', 'Boron'],
    water_stress: ['Drought stress', 'Excess moisture'],
  },
  cardamom: {
    disease: ['Katte disease', 'Azhukal', 'Capsule rot'],
    pest: ['Thrips', 'Shoot borer', 'Nematode'],
    nutrient_deficiency: ['Nitrogen', 'Potassium', 'Zinc'],
    water_stress: ['Drought stress', 'Waterlogging'],
  },
  coconut: {
    disease: ['Root wilt', 'Bud rot', 'Leaf rot'],
    pest: ['Rhinoceros beetle', 'Red palm weevil', 'Eriophyid mite'],
    nutrient_deficiency: ['Potassium', 'Magnesium', 'Boron'],
    water_stress: ['Drought stress', 'Salinity stress'],
  },
};

function normalizeCropKey(cropType: string): string {
  return cropType.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function getIssueCategoryLabel(category: IssueCategory): string {
  return ISSUE_CATEGORY_LABELS[category] ?? category;
}

export function getFallbackIssueTypes(cropType: string, category: IssueCategory): string[] {
  const key = normalizeCropKey(cropType);
  const cropSpecific = CROP_ISSUE_FALLBACKS[key]?.[category];
  if (cropSpecific?.length) return cropSpecific;
  return GLOBAL_FALLBACKS[category] ?? GLOBAL_FALLBACKS.other;
}

export function pickDefaultIssueCategory(): IssueCategory {
  return ISSUE_CATEGORIES[0] ?? 'disease';
}

export function issueCategoryHint(cropType: string): string {
  const crop = cropType.replace(/_/g, ' ').trim() || 'this crop';
  return `Choose issue category, then pick a ${crop}-relevant issue type.`;
}
