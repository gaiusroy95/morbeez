import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { MasterPickerItem } from './master-picker-utils';

export type MasterItem = MasterPickerItem & { master_type?: string };

const cache = new Map<string, MasterItem[]>();

function cacheKey(masterType: string, parentId?: string | null) {
  return `${masterType}:${parentId ?? ''}`;
}

function clearCacheForType(masterType: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${masterType}:`)) cache.delete(key);
  }
}

const DEFAULT_MASTERS_API = '/morbeez-staff/api/v1/os/telecaller/masters';

export function useCrmMasters(
  masterType: string,
  parentId?: string | null,
  options?: { apiBase?: string; search?: string }
) {
  const key = cacheKey(masterType, parentId);
  const apiBase = options?.apiBase ?? DEFAULT_MASTERS_API;
  const [items, setItems] = useState<MasterItem[]>(cache.get(key) ?? []);
  const [loading, setLoading] = useState(!cache.has(key));

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: masterType });
      if (parentId) params.set('parentId', parentId);
      if (options?.search?.trim()) params.set('search', options.search.trim());
      const data = await api<{ ok: boolean; items: MasterItem[] }>(`${apiBase}?${params}`);
      const list = (data.items ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        category: row.category ?? null,
        description: row.description ?? null,
        master_type: row.master_type,
      }));
      cache.set(key, list);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [masterType, parentId, key, apiBase, options?.search]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createMaster = useCallback(
    async (input: string | { name: string; category?: string; description?: string }) => {
      const payload =
        typeof input === 'string'
          ? { name: input.trim() }
          : { name: input.name.trim(), category: input.category, description: input.description };

      const data = await api<{ ok: boolean; item: MasterItem }>(apiBase, {
        method: 'POST',
        body: JSON.stringify({
          masterType,
          name: payload.name,
          parentId: parentId ?? null,
          category: payload.category,
          description: payload.description,
        }),
      });
      clearCacheForType(masterType);
      await reload();
      return {
        id: String(data.item.id),
        name: String(data.item.name),
        category: (data.item as MasterItem).category ?? null,
        description: (data.item as MasterItem).description ?? null,
      };
    },
    [masterType, parentId, apiBase, reload]
  );

  const updateMaster = useCallback(
    async (id: string, patch: { name?: string; category?: string; description?: string }) => {
      const data = await api<{ ok: boolean; item: MasterItem }>(`${apiBase}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      clearCacheForType(masterType);
      await reload();
      return {
        id: String(data.item.id),
        name: String(data.item.name),
        category: (data.item as MasterItem).category ?? null,
        description: (data.item as MasterItem).description ?? null,
      };
    },
    [masterType, apiBase, reload]
  );

  const deleteMaster = useCallback(
    async (id: string) => {
      await api<{ ok: boolean }>(`${apiBase}/${id}`, { method: 'DELETE' });
      clearCacheForType(masterType);
      await reload();
    },
    [masterType, apiBase, reload]
  );

  return { items, loading, reload, createMaster, updateMaster, deleteMaster };
}
