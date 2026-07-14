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

const NUTRIENT_DETECT: Array<{
  id: string;
  diagnosis: string;
  re: RegExp;
}> = [
  {
    id: 'iron',
    diagnosis: 'Iron (Fe) deficiency',
    re: /\b(?:iron|ferrous|ferric|fe(?:\s*edta)?|edta\s*(?:fe|ferrous|iron))\b/i,
  },
  {
    id: 'zinc',
    diagnosis: 'Zinc (Zn) deficiency',
    re: /\b(?:zinc|zn(?:\s*edta)?|edta\s*(?:zn|zinc))\b/i,
  },
  {
    id: 'magnesium',
    diagnosis: 'Magnesium (Mg) deficiency',
    re: /\b(?:magnesium|mgso4|magnesium\s*sul(?:ph|f)ate)\b/i,
  },
  {
    id: 'nitrogen',
    diagnosis: 'Nitrogen (N) deficiency',
    re: /\b(?:nitrogen|ammonium\s*sul(?:ph|f)ate)\b/i,
  },
  {
    id: 'calcium',
    diagnosis: 'Calcium (Ca) deficiency',
    re: /\b(?:calcium|ca(?:\s*edta)?|edta\s*calcium)\b/i,
  },
  {
    id: 'potassium',
    diagnosis: 'Potassium (K) deficiency',
    re: /\b(?:potash|potassium|\bk\b(?:\s*deficien)?|mop|sop|sul(?:ph|f)ate\s+of\s+potash)\b/i,
  },
  {
    id: 'boron',
    diagnosis: 'Boron (B) deficiency',
    re: /\b(?:boron|\bb\b\s*deficien|borax)\b/i,
  },
];

const PEST_DETECT: Array<{ diagnosis: string; re: RegExp }> = [
  { diagnosis: 'Anthracnose (Colletotrichum)', re: /\banthracnose|colletotrichum\b/i },
  { diagnosis: 'Fungal infection', re: /\bfungal?\s+(?:attack|infection|disease)\b/i },
  { diagnosis: 'Thrips', re: /\bthrips?\b/i },
  { diagnosis: 'Mites', re: /\bmites?\b/i },
  { diagnosis: 'Aphids', re: /\baphids?\b/i },
  { diagnosis: 'Whitefly', re: /\bwhitefly\b/i },
  { diagnosis: 'Nematode', re: /\bnematode\b/i },
  { diagnosis: 'Leaf spot', re: /\bleaf\s+spot\b/i },
  { diagnosis: 'Blight', re: /\bblight\b/i },
  { diagnosis: 'Root rot', re: /\broot\s+rot\b/i },
  { diagnosis: 'Water stress', re: /\b(?:water\s+stress|drought|moisture\s+stress)\b/i },
];

/** True when farmer typed a free answer (not a WhatsApp suggestion chip / button id). */
export function looksLikeDescriptiveHypothesis(raw: string): boolean {
  const t = raw.trim();
  if (!t || isFarmerSuggestionButtonId(t)) return false;
  if (/^feedback\./i.test(t)) return false;
  return t.length >= 12;
}

/** All nutrient deficiency labels mentioned in free text (order preserved). */
export function extractAllFarmerNutrientLabels(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const found: string[] = [];
  for (const n of NUTRIENT_DETECT) {
    if (n.re.test(t)) {
      const short = n.diagnosis.replace(' deficiency', '');
      if (!found.includes(short)) found.push(short);
    }
  }
  return found;
}

/**
 * Extract each distinct issue the farmer named — never one combined diagnosis string.
 * Example input → ["Iron (Fe) deficiency", "Zinc (Zn) deficiency", "Magnesium (Mg) deficiency", ...]
 */
export function extractAllFarmerSuggestedDiagnoses(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];

  const lower = t.toLowerCase();
  for (const s of FARMER_NUTRIENT_SUGGESTIONS) {
    if (lower === s.buttonId || lower === `feedback.suggest.${s.id}`) {
      return [s.diagnosis];
    }
  }
  if (lower === FARMER_SUGGEST_OTHER_BUTTON_ID || lower === 'feedback.suggest.other') {
    return [];
  }

  const diagnoses: string[] = [];
  const push = (dx: string) => {
    const d = dx.trim();
    if (d && !diagnoses.includes(d)) diagnoses.push(d);
  };

  for (const n of NUTRIENT_DETECT) {
    if (n.re.test(t)) push(n.diagnosis);
  }
  for (const p of PEST_DETECT) {
    if (p.re.test(t)) push(p.diagnosis);
  }

  if (!diagnoses.length) {
    const listMatch = t.match(/\b(?:this\s+is|its|it's|ഇത്)\s+([^.;]{2,300})/i);
    if (listMatch?.[1]) {
      const parts = listMatch[1]
        .split(/\s*,\s*|\s+and\s+|\s*\/\s*/i)
        .map((p) => p.trim())
        .filter((p) => p.length >= 3 && p.length <= 120);
      for (const p of parts) {
        const nutrientFromPart = extractAllFarmerSuggestedDiagnoses(p);
        if (nutrientFromPart.length) {
          for (const d of nutrientFromPart) push(d);
        } else {
          push(/deficien/i.test(p) ? p : `${p} deficiency`);
        }
      }
    }
  }

  if (!diagnoses.length && /deficien/i.test(t)) {
    push(t.slice(0, 200));
  }

  return diagnoses.slice(0, 8);
}

/**
 * @deprecated Display-only summary. Prefer extractAllFarmerSuggestedDiagnoses for storage.
 */
export function summarizeFarmerNutrientSuggestion(raw: string): string | null {
  const all = extractAllFarmerSuggestedDiagnoses(raw);
  if (!all.length) return null;
  if (all.length === 1) return all[0]!;
  return all.join('; ');
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

  const all = extractAllFarmerSuggestedDiagnoses(t);
  if (all.length === 1) return all[0]!;
  if (all.length > 1) return all[0]!;
  return undefined;
}

export function isFarmerSuggestionButtonId(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (lower === FARMER_SUGGEST_OTHER_BUTTON_ID) return true;
  return FARMER_NUTRIENT_SUGGESTIONS.some((s) => s.buttonId === lower);
}

/** Read structured diagnoses from feedback row (metadata array or re-parse legacy text). */
export function getFarmerSuggestedDiagnosesFromStored(params: {
  farmer_suggested_diagnosis?: string | null;
  farmer_prior_experience?: string | null;
  metadata?: Record<string, unknown> | null;
}): string[] {
  const refined = params.metadata?.farmer_refined_assessment as
    | { conditions?: Array<{ label?: string }> }
    | undefined;
  if (Array.isArray(refined?.conditions) && refined.conditions.length) {
    const labels = refined.conditions
      .map((c) => String(c.label ?? '').trim())
      .filter(Boolean)
      .slice(0, 8);
    if (labels.length) return labels;
  }

  const meta = params.metadata?.farmer_suggested_diagnoses;
  if (Array.isArray(meta) && meta.length) {
    return meta.map((d) => String(d).trim()).filter(Boolean).slice(0, 8);
  }

  const source = [params.farmer_suggested_diagnosis, params.farmer_prior_experience]
    .filter(Boolean)
    .join('\n');
  if (source.trim()) {
    const extracted = extractAllFarmerSuggestedDiagnoses(source);
    if (extracted.length) return extracted;
  }

  if (params.farmer_suggested_diagnosis?.trim()) {
    return [params.farmer_suggested_diagnosis.trim()];
  }
  return [];
}
