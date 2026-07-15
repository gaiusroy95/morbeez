import { collectFarmerRecommendations, issueMatchesFarmerLabel, type FarmerRecommendationSource } from './farmer-recommendation-issues.js';

export type FarmerActiveIngredient = {
  label: string;
  dose?: string;
  method?: string;
};

export type FarmerAiMatchStatus = 'match' | 'conflict' | 'partial' | 'unknown';

export type FarmerExperienceSections = {
  observations: string[];
  activeIngredients: FarmerActiveIngredient[];
  symptomsReported?: string | null;
  responseAfterApplication?: string | null;
};

const DOSE_RE = /(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|liters?|litres?))/i;
const METHOD_RE = /(foliar spray|foliar|spray|soil application|drench|per\s+\d+\s*l)/i;

const INGREDIENT_SCAN: Array<{ re: RegExp; label: string }> = [
  { re: /\bedta\s*(?:ferrous|fe|iron)\b/gi, label: 'EDTA Fe' },
  { re: /\bedta\s*(?:zinc|zn)\b/gi, label: 'EDTA Zn' },
  { re: /\bedta\s*calcium\b/gi, label: 'EDTA Ca' },
  { re: /\bmagnesium\s*sul(?:ph|f)ate\b/gi, label: 'Magnesium sulphate' },
  { re: /\bammonium\s*sul(?:ph|f)ate\b/gi, label: 'Ammonium sulphate' },
  { re: /\bzinc\s*sul(?:ph|f)ate\b/gi, label: 'Zinc sulphate' },
  { re: /\bferrous\s*sul(?:ph|f)ate\b/gi, label: 'Ferrous sulphate' },
  { re: /\bcopper\s*oxychloride\b/gi, label: 'Copper oxychloride' },
  { re: /\bmancozeb\b/gi, label: 'Mancozeb' },
  { re: /\bspinetoram\b/gi, label: 'Spinetoram' },
];

function extractDoseNear(text: string, index: number): string | undefined {
  const window = text.slice(Math.max(0, index - 20), index + 120);
  const eachAt = window.match(/(?:each\s+at|at)\s+(\d+(?:\.\d+)?\s*(?:g|kg|ml|l))/i);
  if (eachAt?.[1]) return eachAt[1].replace(/\s+/g, ' ');
  const dose = window.match(DOSE_RE);
  return dose?.[1]?.replace(/\s+/g, ' ');
}

function extractMethod(text: string): string | undefined {
  const m = text.match(METHOD_RE);
  if (!m?.[1]) return undefined;
  const raw = m[1].toLowerCase();
  if (raw.includes('foliar')) return 'foliar spray';
  if (raw.includes('soil')) return 'soil application';
  if (raw.includes('spray')) return 'spray';
  return m[1];
}

/** Parse farmer product / experience text into scannable active-ingredient rows. */
export function parseFarmerActiveIngredients(
  priorProduct?: string | null,
  priorExperience?: string | null
): FarmerActiveIngredient[] {
  const source = [priorProduct, priorExperience].filter(Boolean).join('. ');
  if (!source.trim()) return [];

  const items: FarmerActiveIngredient[] = [];
  const seen = new Set<string>();
  const globalMethod = extractMethod(source);

  for (const { re, label } of INGREDIENT_SCAN) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const scan = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = scan.exec(source)) !== null) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        label,
        dose: extractDoseNear(source, m.index),
        method: extractMethod(m[0]) ?? globalMethod,
      });
    }
  }

  if (!items.length && priorProduct?.trim()) {
    for (const part of priorProduct.split(/[,;]+/)) {
      const t = part.trim();
      if (!t) continue;
      const dose = t.match(DOSE_RE)?.[1];
      const name = t.replace(DOSE_RE, '').trim() || t;
      items.push({ label: name, dose: dose?.replace(/\s+/g, ' ') });
    }
  }

  return items.slice(0, 12);
}

export function formatActiveIngredientLine(item: FarmerActiveIngredient): string {
  const parts = [item.label];
  if (item.dose) parts.push(item.dose);
  if (item.method) parts.push(`(${item.method})`);
  return parts.join(' ');
}

export function buildFarmerExperienceSections(
  source?: (FarmerRecommendationSource & {
    priorExperience?: string | null;
    priorProduct?: string | null;
    priorOutcome?: string | null;
  }) | null
): FarmerExperienceSections {
  const observations = collectFarmerRecommendations(source).map((r) => r.label);
  const activeIngredients = parseFarmerActiveIngredients(source?.priorProduct, source?.priorExperience);

  let symptomsReported: string | null = null;
  const exp = source?.priorExperience?.trim();
  if (exp && !/^i\s+applied\b/i.test(exp)) {
    symptomsReported = exp.slice(0, 500);
  }

  return {
    observations,
    activeIngredients,
    symptomsReported,
    responseAfterApplication: source?.priorOutcome?.trim() || null,
  };
}

export function resolveFarmerAiMatchStatus(
  aiDiagnosis: string | null | undefined,
  farmerLabel: string | null | undefined
): FarmerAiMatchStatus {
  const ai = aiDiagnosis?.trim();
  const farmer = farmerLabel?.trim();
  if (!ai || !farmer) return 'unknown';
  if (issueMatchesFarmerLabel(ai, farmer, ai)) return 'match';

  const aiL = ai.toLowerCase();
  const fL = farmer.toLowerCase();
  if (/deficien/.test(aiL) && /deficien/.test(fL)) return 'partial';

  return 'conflict';
}

export function farmerMatchStatusLabel(status: FarmerAiMatchStatus): string {
  switch (status) {
    case 'match':
      return 'Match';
    case 'conflict':
      return 'Conflict';
    case 'partial':
      return 'Partial';
    default:
      return '—';
  }
}

export function composeStructuredRecommendationText(fields: {
  activeIngredient?: string;
  dose?: string;
  method?: string;
  remarks?: string;
}): string {
  const parts = [
    fields.activeIngredient?.trim(),
    fields.dose?.trim(),
    fields.method?.trim(),
    fields.remarks?.trim(),
  ].filter(Boolean);
  return parts.join(' — ');
}

export const VALIDATION_DIFF_BANNER =
  'AI and farmer observations differ. Review and validate before approval.';
