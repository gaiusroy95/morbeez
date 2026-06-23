type NutrientSpec = { id: string; label: string; patterns: RegExp[] };

const NUTRIENT_SPECS: NutrientSpec[] = [
  { id: 'nitrogen', label: 'Nitrogen Deficiency', patterns: [/\bnitrogen\b/i, /\bnitrogin\b/i] },
  { id: 'potassium', label: 'Potassium Deficiency', patterns: [/\bpotassium\b/i, /\bpotash\b/i] },
  { id: 'phosphorus', label: 'Phosphorus Deficiency', patterns: [/\bphosphorus\b/i, /\bphosphorous\b/i] },
  { id: 'zinc', label: 'Zinc Deficiency', patterns: [/\bzinc\b/i] },
  { id: 'iron', label: 'Iron Deficiency', patterns: [/\biron\b/i] },
  { id: 'magnesium', label: 'Magnesium Deficiency', patterns: [/\bmagnesium\b/i] },
  { id: 'boron', label: 'Boron Deficiency', patterns: [/\bboron\b/i] },
  { id: 'sulfur', label: 'Sulfur Deficiency', patterns: [/\bsulfur\b/i, /\bsulphur\b/i] },
];

function nutrientIdsInFragment(text: string): string[] {
  const found: string[] = [];
  for (const spec of NUTRIENT_SPECS) {
    if (spec.patterns.some((p) => p.test(text))) found.push(spec.id);
  }
  if (/\bN\b/.test(text) && !found.includes('nitrogen')) found.push('nitrogen');
  if (/\bK\b/.test(text) && !found.includes('potassium')) found.push('potassium');
  return found;
}

export function detectNutrientIds(text: string): string[] {
  const hay = text.trim();
  if (!hay) return [];
  const unique = new Set(nutrientIdsInFragment(hay));
  const paren = hay.match(/\(([^)]+)\)/);
  if (paren?.[1]) {
    for (const part of paren[1].split(/\s+and\s+|,\s*|\s*\/\s*/i)) {
      for (const id of nutrientIdsInFragment(part.trim())) unique.add(id);
    }
  }
  if (/\b(and|&|\/)\b/i.test(hay) && /nutrient|deficien/i.test(hay)) {
    for (const part of hay.split(/\b(?:and|&|\/)\b/i)) {
      for (const id of nutrientIdsInFragment(part.trim())) unique.add(id);
    }
  }
  return [...unique];
}

export function shouldSplitNutrientIssue(issueName: string, diagnosis?: string): boolean {
  return detectNutrientIds(`${issueName} ${diagnosis ?? ''}`).length > 1;
}

type SplittableIssue = {
  issueName: string;
  category?: string;
  finalDiagnosis?: string;
  localId?: string;
  aiCaseId?: string;
  [key: string]: unknown;
};

/** Split combined nutrient rows (e.g. N+K) into separate issues for the wizard. */
export function expandSeparateNutrientIssues<T extends SplittableIssue>(
  issues: T[],
  maxIssues = 8
): T[] {
  const out: T[] = [];
  for (const issue of issues) {
    const label = `${issue.issueName} ${issue.finalDiagnosis ?? ''}`;
    const nutrientIds = detectNutrientIds(label);
    const isNutrient =
      issue.category === 'nutrient_deficiency' || /nutrient|deficien/i.test(issue.issueName);

    if (isNutrient && nutrientIds.length > 1) {
      for (const id of nutrientIds) {
        const spec = NUTRIENT_SPECS.find((s) => s.id === id);
        if (!spec) continue;
        out.push({
          ...issue,
          localId: `${issue.localId ?? 'issue'}-${id}`,
          category: 'nutrient_deficiency',
          issueName: spec.label,
          finalDiagnosis: spec.label,
          selectedHypothesisLabel: spec.label,
        });
      }
    } else {
      out.push(issue);
    }
  }
  return out.slice(0, maxIssues);
}
