export type RecommendationAuditAction =
  | 'created'
  | 'updated'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'communicated'
  | 'cancelled';

export type RecommendationAuditEntry = {
  action: RecommendationAuditAction;
  by: string;
  at: string;
  note?: string | null;
  fields?: string[];
};

export function readAuditLog(metadata: unknown): RecommendationAuditEntry[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const log = (metadata as { auditLog?: unknown }).auditLog;
  if (!Array.isArray(log)) return [];
  return log
    .filter((e) => e && typeof e === 'object' && 'action' in e && 'by' in e && 'at' in e)
    .map((e) => e as RecommendationAuditEntry);
}

export function appendAuditEntry(
  metadata: unknown,
  entry: Omit<RecommendationAuditEntry, 'at'> & { at?: string }
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  const log = readAuditLog(base);
  log.push({
    ...entry,
    at: entry.at ?? new Date().toISOString(),
  });
  return { ...base, auditLog: log };
}

export function formatAuditLabel(entry: RecommendationAuditEntry): string {
  const who = entry.by || 'system';
  const when = formatDt(entry.at);
  switch (entry.action) {
    case 'created':
      return `Created by ${who} · ${when}`;
    case 'updated':
      return `Edited by ${who}${entry.fields?.length ? ` (${entry.fields.join(', ')})` : ''} · ${when}`;
    case 'submitted':
      return `Submitted for approval by ${who} · ${when}`;
    case 'approved':
      return `Approved by ${who} · ${when}`;
    case 'rejected':
      return `Rejected by ${who}${entry.note ? ` — ${entry.note}` : ''} · ${when}`;
    case 'communicated':
      return `Sent to farmer by ${who} · ${when}`;
    case 'cancelled':
      return `Cancelled by ${who} · ${when}`;
    default:
      return `${entry.action} · ${who} · ${when}`;
  }
}

function formatDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}
