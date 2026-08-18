/** Date-only Channel Pool helpers (Asia/Kolkata calendar). */

export const CHANNEL_POOL_PRESETS = [0, 8, 10, 12, 14, 16, 18, 20, 22, 25, 30] as const;

export type ChannelPoolStatus = 'pending' | 'active' | 'closed';

export type ChannelPoolVersionRow = {
  id: string;
  productId: string;
  variantId: string;
  sku: string | null;
  versionNumber: number;
  poolPct: number;
  previousPoolPct: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: ChannelPoolStatus;
  changeReason: string;
  editedByAdminId: string | null;
  editedByName: string | null;
  editedAt: string;
};

export type ChannelPoolSnapshot = {
  channelPoolPct: number | null;
  channelPoolVersionId: string | null;
  channelPoolVersionLabel: string | null;
  channelPoolEffectiveFrom: string | null;
  channelPoolAmount: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** YYYY-MM-DD in India. */
export function indiaToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function versionLabel(versionNumber: number): string {
  return `V${versionNumber}`;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

export function derivePoolStatus(
  row: { effectiveFrom: string; effectiveTo: string | null },
  asOf: string
): ChannelPoolStatus {
  if (row.effectiveFrom > asOf) return 'pending';
  if (row.effectiveTo && row.effectiveTo < asOf) return 'closed';
  return 'active';
}

export function validatePoolPct(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error('Channel Pool must be between 0 and 100');
  }
  return round2(n);
}

export function channelPoolAmount(salesInr: number, poolPct: number | null | undefined): number | null {
  if (poolPct == null || !Number.isFinite(poolPct)) return null;
  if (!Number.isFinite(salesInr) || salesInr <= 0) return 0;
  return round2((salesInr * poolPct) / 100);
}

export function emptyChannelPoolSnapshot(): ChannelPoolSnapshot {
  return {
    channelPoolPct: null,
    channelPoolVersionId: null,
    channelPoolVersionLabel: null,
    channelPoolEffectiveFrom: null,
    channelPoolAmount: null,
  };
}

export function snapshotFromVersion(
  version: ChannelPoolVersionRow | null | undefined,
  salesInr?: number
): ChannelPoolSnapshot {
  if (!version) return emptyChannelPoolSnapshot();
  return {
    channelPoolPct: version.poolPct,
    channelPoolVersionId: version.id,
    channelPoolVersionLabel: versionLabel(version.versionNumber),
    channelPoolEffectiveFrom: version.effectiveFrom,
    channelPoolAmount: channelPoolAmount(salesInr ?? 0, version.poolPct),
  };
}

/**
 * Version effective on asOf: range contains the date, latest version_number wins
 * (same-day revisions keep historical snapshots on older version ids).
 */
export function resolveVersionOnDate(
  versions: ChannelPoolVersionRow[],
  asOf: string
): ChannelPoolVersionRow | null {
  const hits = versions.filter((v) => {
    if (v.effectiveFrom > asOf) return false;
    if (v.effectiveTo && v.effectiveTo < asOf) return false;
    return true;
  });
  if (!hits.length) return null;
  hits.sort((a, b) => b.versionNumber - a.versionNumber);
  return hits[0] ?? null;
}

export function currentAndPrevious(
  versions: ChannelPoolVersionRow[],
  asOf: string
): { current: ChannelPoolVersionRow | null; previous: ChannelPoolVersionRow | null } {
  const current = resolveVersionOnDate(versions, asOf);
  if (!current) return { current: null, previous: null };
  const older = versions
    .filter((v) => v.versionNumber < current.versionNumber)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  return { current, previous: older[0] ?? null };
}

export function isNoOpPoolChange(
  current: ChannelPoolVersionRow | null,
  nextPct: number,
  nextFrom: string
): boolean {
  if (!current) return false;
  return current.poolPct === nextPct && current.effectiveFrom === nextFrom;
}
