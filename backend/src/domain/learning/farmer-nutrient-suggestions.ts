/** Structured farmer suggestions for the diagnosis learning loop (nutrient disputes). */

export const FARMER_NUTRIENT_SUGGESTIONS = [
  {
    id: 'iron',
    buttonId: 'feedback.suggest.iron',
    label: 'Iron (Fe) deficiency',
    diagnosis: 'Iron (Fe) deficiency',
  },
  {
    id: 'zinc',
    buttonId: 'feedback.suggest.zinc',
    label: 'Zinc (Zn) deficiency',
    diagnosis: 'Zinc (Zn) deficiency',
  },
  {
    id: 'magnesium',
    buttonId: 'feedback.suggest.magnesium',
    label: 'Magnesium (Mg) deficiency',
    diagnosis: 'Magnesium (Mg) deficiency',
  },
  {
    id: 'nitrogen',
    buttonId: 'feedback.suggest.nitrogen',
    label: 'Nitrogen (N) deficiency',
    diagnosis: 'Nitrogen (N) deficiency',
  },
] as const;

export type FarmerNutrientSuggestionId = (typeof FARMER_NUTRIENT_SUGGESTIONS)[number]['id'];

export const FARMER_SUGGEST_OTHER_BUTTON_ID = 'feedback.suggest.other';

const NUTRIENT_TEXT_PATTERNS: Array<{ id: FarmerNutrientSuggestionId; re: RegExp; diagnosis: string }> = [
  {
    id: 'iron',
    re: /\b(iron(\s+deficiency|\s+deficient)?|\bfe\b(\s*deficiency|\s*deficient)?)\b/i,
    diagnosis: 'Iron (Fe) deficiency',
  },
  {
    id: 'zinc',
    re: /\b(zinc(\s+deficiency|\s+deficient)?|\bzn\b(\s*deficiency|\s*deficient)?)\b/i,
    diagnosis: 'Zinc (Zn) deficiency',
  },
  {
    id: 'magnesium',
    re: /\b(magnesium(\s+deficiency|\s+deficient)?|\bmg\b(\s*deficiency|\s*deficient)?)\b/i,
    diagnosis: 'Magnesium (Mg) deficiency',
  },
  {
    id: 'nitrogen',
    re: /\b(nitrogen(\s+deficiency|\s+deficient)?|\bn\b\s*(deficiency|deficient))\b/i,
    diagnosis: 'Nitrogen (N) deficiency',
  },
];

/** Returns diagnosis if nutrient match; null if "other"; undefined if not a suggestion input. */
export function mapFarmerSuggestionInput(raw: string): string | null | undefined {
  const t = raw.trim();
  if (!t) return undefined;

  const lower = t.toLowerCase();
  for (const s of FARMER_NUTRIENT_SUGGESTIONS) {
    if (lower === s.buttonId || lower === `feedback.suggest.${s.id}`) return s.diagnosis;
  }
  if (lower === FARMER_SUGGEST_OTHER_BUTTON_ID || lower === 'feedback.suggest.other') {
    return null;
  }

  for (const p of NUTRIENT_TEXT_PATTERNS) {
    if (p.re.test(t)) return p.diagnosis;
  }
  return undefined;
}

export function isFarmerSuggestionButtonId(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (lower === FARMER_SUGGEST_OTHER_BUTTON_ID) return true;
  return FARMER_NUTRIENT_SUGGESTIONS.some((s) => s.buttonId === lower);
}
