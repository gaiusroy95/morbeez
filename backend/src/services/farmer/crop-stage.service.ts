/** Crop-specific DAP → growth stage rules for farmer portal surfaces. */

const GINGER_CYCLE_DAYS = 270;

const GINGER_STAGES: Array<{ maxDap: number; label: string }> = [
  { maxDap: 30, label: 'Sprouting' },
  { maxDap: 90, label: 'Vegetative' },
  { maxDap: 150, label: 'Tillering' },
  { maxDap: 210, label: 'Bulking' },
  { maxDap: Infinity, label: 'Maturity' },
];

const DEFAULT_STAGES: Array<{ maxDap: number; label: string }> = [
  { maxDap: 30, label: 'Early growth' },
  { maxDap: 60, label: 'Vegetative growth' },
  { maxDap: 120, label: 'Active development' },
  { maxDap: Infinity, label: 'Maturity phase' },
];

function normalizeCrop(crop: string | null | undefined): string {
  return (crop ?? '').trim().toLowerCase();
}

function stageFromTable(dap: number, table: Array<{ maxDap: number; label: string }>): string {
  for (const row of table) {
    if (dap <= row.maxDap) return row.label;
  }
  return table[table.length - 1]?.label ?? 'Growing';
}

export function cropCycleDays(crop: string | null | undefined): number {
  const c = normalizeCrop(crop);
  if (c === 'ginger') return GINGER_CYCLE_DAYS;
  return 365;
}

export function growthStageFromDap(
  crop: string | null | undefined,
  dap: number | null,
  storedStage?: string | null
): string {
  if (storedStage?.trim()) return storedStage.trim();
  if (dap == null) return 'Growing';
  const table = normalizeCrop(crop) === 'ginger' ? GINGER_STAGES : DEFAULT_STAGES;
  return stageFromTable(dap, table);
}

/** @deprecated Use growthStageFromDap */
export function growthStageLabel(
  crop: string | null | undefined,
  stage: string | null | undefined,
  dap: number | null
): string {
  return growthStageFromDap(crop, dap, stage);
}
