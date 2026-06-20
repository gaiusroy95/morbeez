/** React list key that stays unique even when upstream data repeats the same id. */
export function stableRowKey(id: string | number | null | undefined, index: number): string {
  const base = id != null && String(id).trim() ? String(id) : 'row';
  return `${base}__${index}`;
}

/** Keep first occurrence of each key (preserves order). */
export function dedupeBy<T>(items: readonly T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
