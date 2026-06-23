type NutrientSpec = {
  id: string;
  label: string;
  patterns: RegExp[];
};

const NUTRIENT_SPECS: NutrientSpec[] = [
  {
    id: 'nitrogen',
    label: 'Nitrogen Deficiency',
    patterns: [/\bnitrogen\b/i, /\bnitrogin\b/i, /\bn-deficien/i],
  },
  {
    id: 'potassium',
    label: 'Potassium Deficiency',
    patterns: [/\bpotassium\b/i, /\bpotash\b/i, /\bk-deficien/i],
  },
  {
    id: 'phosphorus',
    label: 'Phosphorus Deficiency',
    patterns: [/\bphosphorus\b/i, /\bphosphorous\b/i, /\bphosphate\b/i, /\bp-deficien/i],
  },
  {
    id: 'zinc',
    label: 'Zinc Deficiency',
    patterns: [/\bzinc\b/i, /\bzn-deficien/i],
  },
  {
    id: 'iron',
    label: 'Iron Deficiency',
    patterns: [/\biron\b/i, /\bfe-deficien/i],
  },
  {
    id: 'magnesium',
    label: 'Magnesium Deficiency',
    patterns: [/\bmagnesium\b/i, /\bmg-deficien/i],
  },
  {
    id: 'boron',
    label: 'Boron Deficiency',
    patterns: [/\bboron\b/i, /\bb-deficien/i],
  },
  {
    id: 'sulfur',
    label: 'Sulfur Deficiency',
    patterns: [/\bsulfur\b/i, /\bsulphur\b/i, /\bs-deficien/i],
  },
];

function clampConfidence(n: number): number {
  return Math.max(0.05, Math.min(0.98, n));
}

function nutrientIdsInFragment(text: string): string[] {
  const found: string[] = [];
  for (const spec of NUTRIENT_SPECS) {
    if (spec.patterns.some((p) => p.test(text))) found.push(spec.id);
  }
  if (/\bN\b/.test(text) && !found.includes('nitrogen')) found.push('nitrogen');
  if (/\bK\b/.test(text) && !found.includes('potassium')) found.push('potassium');
  if (/\bP\b/.test(text) && !found.includes('phosphorus')) found.push('phosphorus');
  return found;
}

/** Detect distinct nutrient deficiencies mentioned in combined issue text. */
export function detectNutrientIds(text: string): string[] {
  const hay = text.trim();
  if (!hay) return [];

  const fromWhole = nutrientIdsInFragment(hay);
  const unique = new Set(fromWhole);

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

export function shouldSplitNutrientIssue(issueName: string, conclusion?: string): boolean {
  return detectNutrientIds(`${issueName} ${conclusion ?? ''}`).length > 1;
}

type SplittableIssue = {
  category: string;
  issueName: string;
  confidence: number;
  observation?: string;
  rootCause: {
    symptoms: string[];
    photoSignals: string[];
    soilSignals: string[];
    weatherSignals: string[];
    conclusion: string;
  };
  evidence: Record<string, string>;
};

function splitOneIssue<T extends SplittableIssue>(issue: T): T[] {
  const nutrientIds = detectNutrientIds(`${issue.issueName} ${issue.rootCause.conclusion}`);
  if (nutrientIds.length <= 1) return [issue];

  const specs = nutrientIds
    .map((id) => NUTRIENT_SPECS.find((s) => s.id === id))
    .filter((s): s is NutrientSpec => Boolean(s));

  return specs.map((spec, index) => ({
    ...issue,
    category: 'nutrient_deficiency',
    issueName: spec.label,
    confidence: clampConfidence(issue.confidence * (0.94 - index * 0.02)),
    rootCause: {
      ...issue.rootCause,
      conclusion: spec.label,
      weatherSignals: [
        ...issue.rootCause.weatherSignals,
        `Split from combined finding; assess ${spec.label.toLowerCase()} against 7-day weather pattern`,
      ],
    },
  }));
}

/** Expand combined nutrient issues into one row per deficiency (never merge N+K). */
export function expandSeparateVisitIssues<T extends SplittableIssue>(
  issues: T[],
  maxIssues = 8
): T[] {
  const expanded: T[] = [];
  for (const issue of issues) {
    const isNutrient =
      issue.category === 'nutrient_deficiency' ||
      /nutrient|deficien/i.test(issue.issueName) ||
      shouldSplitNutrientIssue(issue.issueName, issue.rootCause.conclusion);

    if (isNutrient && shouldSplitNutrientIssue(issue.issueName, issue.rootCause.conclusion)) {
      expanded.push(...splitOneIssue(issue));
    } else {
      expanded.push(issue);
    }
  }
  return expanded.slice(0, maxIssues);
}
