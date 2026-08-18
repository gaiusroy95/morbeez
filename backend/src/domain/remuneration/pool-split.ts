export type PoolSplit = {
  poolPct: number;
  agronomistMaxPct: number;
  partnerMaxPct: number;
};

export function resolvePoolSplit(input: {
  poolPct: number;
  agronomistMaxPct?: number | null;
  partnerMaxPct?: number | null;
}): PoolSplit {
  const poolPct = Math.round(Math.max(0, Number(input.poolPct) || 0) * 100) / 100;
  const agroRaw = input.agronomistMaxPct;
  const partnerRaw = input.partnerMaxPct;
  const partnerMaxPct =
    partnerRaw == null || !Number.isFinite(Number(partnerRaw))
      ? poolPct
      : Math.round(Math.max(0, Number(partnerRaw)) * 100) / 100;
  const agronomistMaxPct =
    agroRaw == null || !Number.isFinite(Number(agroRaw))
      ? 0
      : Math.round(Math.max(0, Number(agroRaw)) * 100) / 100;
  return { poolPct, agronomistMaxPct, partnerMaxPct };
}

export function validatePoolSplit(split: PoolSplit): void {
  if (split.poolPct < 0 || split.poolPct > 100) {
    throw new Error('Channel Pool must be between 0 and 100');
  }
  if (split.agronomistMaxPct < 0 || split.partnerMaxPct < 0) {
    throw new Error('Agronomist and Partner pool % cannot be negative');
  }
  if (split.agronomistMaxPct + split.partnerMaxPct - split.poolPct > 0.001) {
    throw new Error('Agronomist % + Partner % cannot exceed Channel Pool %');
  }
}
