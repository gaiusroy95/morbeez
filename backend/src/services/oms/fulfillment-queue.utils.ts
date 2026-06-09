/** Supabase may return a one-to-many embed as a single object when only one row exists. */
export function normalizeRelation<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  return [raw as T];
}

export function normalizePickLists<T extends { pick_list_lines?: unknown }>(
  raw: unknown
): T[] {
  return normalizeRelation<T>(raw);
}

export function pickListLineCount(
  pickLists: Array<{ pick_list_lines?: Array<{ qty_required?: number }> }>
): number {
  const lists = normalizePickLists(pickLists);
  const pick = lists[0];
  const lines = pick?.pick_list_lines;
  if (!Array.isArray(lines) || !lines.length) return 0;
  return lines.reduce((sum, l) => sum + Math.max(0, Number(l.qty_required) || 1), 0);
}
