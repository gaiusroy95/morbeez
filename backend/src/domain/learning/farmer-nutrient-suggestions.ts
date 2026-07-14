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

const NUTRIENT_DETECT: Array<{ id: FarmerNutrientSuggestionId | 'calcium'; label: string; re: RegExp }> =
  [
    {
      id: 'iron',
      label: 'Iron (Fe)',
      re: /\b(?:iron|ferrous|ferric|fe(?:\s*edta)?|edta\s*(?:fe|ferrous|iron))\b/i,
    },
    {
      id: 'zinc',
      label: 'Zinc (Zn)',
      re: /\b(?:zinc|zn(?:\s*edta)?|edta\s*(?:zn|zinc))\b/i,
    },
    {
      id: 'magnesium',
      label: 'Magnesium (Mg)',
      re: /\b(?:magnesium|mgso4|magnesium\s*sul(?:ph|f)ate)\b/i,
    },
    {
      id: 'nitrogen',
      label: 'Nitrogen (N)',
      re: /\b(?:nitrogen|ammonium\s*sul(?:ph|f)ate)\b/i,
    },
    {
      id: 'calcium',
      label: 'Calcium (Ca)',
      re: /\b(?:calcium|ca(?:\s*edta)?|edta\s*calcium)\b/i,
    },
  ];

/** All nutrient deficiency labels mentioned in free text (order preserved). */
export function extractAllFarmerNutrientLabels(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const found: string[] = [];
  for (const n of NUTRIENT_DETECT) {
    if (n.re.test(t) && !found.includes(n.label)) found.push(n.label);
  }
  return found;
}

/**
 * Compact diagnosis summary for multi-nutrient farmer replies.
 * Example: "Iron (Fe), Zinc (Zn), Magnesium (Mg), Nitrogen (N) deficiency; calcium supply needed"
 */
export function summarizeFarmerNutrientSuggestion(raw: string): string | null {
  const labels = extractAllFarmerNutrientLabels(raw);
  if (!labels.length) return null;

  const core = labels.filter((l) => !l.startsWith('Calcium'));
  const hasCa = labels.some((l) => l.startsWith('Calcium'));
  const parts: string[] = [];
  if (core.length) {
    parts.push(`${core.join(', ')} deficiency`);
  }
  if (hasCa) {
    parts.push(core.length ? 'calcium supply needed' : 'Calcium (Ca) deficiency');
  }
  return parts.join('; ');
}

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

  const summary = summarizeFarmerNutrientSuggestion(t);
  if (summary) return summary;
  return undefined;
}

export function isFarmerSuggestionButtonId(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (lower === FARMER_SUGGEST_OTHER_BUTTON_ID) return true;
  return FARMER_NUTRIENT_SUGGESTIONS.some((s) => s.buttonId === lower);
}
