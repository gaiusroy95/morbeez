type CacheEntry = { data: unknown; at: number };

const store = new Map<string, CacheEntry>();

export function getCachedResponse<T>(key: string, ttlMs: number): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function setCachedResponse<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}

export async function fetchWithCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  opts?: { force?: boolean }
): Promise<T> {
  if (!opts?.force) {
    const cached = getCachedResponse<T>(key, ttlMs);
    if (cached != null) return cached;
  }
  const data = await fetcher();
  setCachedResponse(key, data);
  return data;
}

export function invalidateCachedResponses(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
