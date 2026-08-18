export type KpiUnit = 'pct' | 'inr' | 'count';

export type KpiParameter = {
  key: string;
  label: string;
  weightPct: number;
  target: number;
  unit: KpiUnit;
};

export type KpiParameterScore = KpiParameter & {
  actual: number;
  score: number;
  weighted: number;
};

export const DEFAULT_PARTNER_KPI_WEIGHTS: KpiParameter[] = [
  { key: 'eligible_sales', label: 'Eligible Delivered Sales', weightPct: 30, target: 100_000, unit: 'inr' },
  { key: 'farmer_retention', label: 'Farmer Retention', weightPct: 20, target: 80, unit: 'pct' },
  { key: 'field_service', label: 'Field Service', weightPct: 15, target: 80, unit: 'pct' },
  { key: 'territory', label: 'Territory Penetration', weightPct: 15, target: 80, unit: 'pct' },
  { key: 'collections', label: 'Collections', weightPct: 10, target: 90, unit: 'pct' },
  { key: 'advocacy', label: 'Advocacy / Digital', weightPct: 5, target: 50, unit: 'pct' },
  { key: 'lead_response', label: 'Lead Response', weightPct: 3, target: 80, unit: 'pct' },
  { key: 'reporting', label: 'Reporting', weightPct: 2, target: 80, unit: 'pct' },
];

export const DEFAULT_AGRONOMIST_KPI_WEIGHTS: KpiParameter[] = [
  { key: 'qualified_cases', label: 'Qualified Cases', weightPct: 40, target: 300, unit: 'count' },
  { key: 'diagnosis_accuracy', label: 'Diagnosis Accuracy', weightPct: 35, target: 90, unit: 'pct' },
  { key: 'eligible_sales', label: 'Attributed Eligible Sales', weightPct: 25, target: 300_000, unit: 'inr' },
];

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Achievement vs target, capped at 100. Percent parameters already live on 0–100. */
export function parameterScore(actual: number, target: number): number {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return clampScore((Number(actual) / t) * 100);
}

export function validateWeights(parameters: KpiParameter[]): void {
  if (!parameters.length) throw new Error('KPI weights cannot be empty');
  const sum = parameters.reduce((acc, p) => acc + Number(p.weightPct || 0), 0);
  if (Math.abs(sum - 100) > 0.05) {
    throw new Error(`KPI weights must sum to 100 (got ${sum})`);
  }
  for (const p of parameters) {
    if (!p.key) throw new Error('Each KPI parameter needs a key');
    if (Number(p.weightPct) < 0) throw new Error(`Negative weight on ${p.key}`);
    if (!(Number(p.target) > 0)) throw new Error(`Target must be > 0 on ${p.key}`);
  }
}

export function scoreWeightedKpi(
  parameters: KpiParameter[],
  actuals: Record<string, number>
): { total: number; lines: KpiParameterScore[] } {
  validateWeights(parameters);
  const lines = parameters.map((p) => {
    const actual = Number(actuals[p.key] ?? 0);
    const score = parameterScore(actual, p.target);
    const weighted = Math.round(score * (p.weightPct / 100) * 10) / 10;
    return { ...p, actual, score: Math.round(score * 10) / 10, weighted };
  });
  const total = Math.round(lines.reduce((acc, l) => acc + l.weighted, 0) * 10) / 10;
  return { total: clampScore(total), lines };
}
