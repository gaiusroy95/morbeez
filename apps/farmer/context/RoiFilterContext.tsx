import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RoiFilterState } from '@morbeez/shared';

type RoiFilterContextValue = {
  filter: RoiFilterState;
  setFilter: (next: RoiFilterState) => void;
  setCrop: (crop: string | null) => void;
  setBlockId: (blockId: string | null) => void;
};

const RoiFilterContext = createContext<RoiFilterContextValue | null>(null);

export function RoiFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<RoiFilterState>({});

  const setCrop = useCallback((crop: string | null) => {
    setFilter((f) => ({ ...f, crop: crop ?? undefined }));
  }, []);

  const setBlockId = useCallback((blockId: string | null) => {
    setFilter((f) => ({ ...f, blockId: blockId ?? undefined }));
  }, []);

  const value = useMemo(
    () => ({ filter, setFilter, setCrop, setBlockId }),
    [filter, setCrop, setBlockId]
  );

  return <RoiFilterContext.Provider value={value}>{children}</RoiFilterContext.Provider>;
}

export function useRoiFilter(): RoiFilterContextValue {
  const ctx = useContext(RoiFilterContext);
  if (!ctx) throw new Error('useRoiFilter must be used within RoiFilterProvider');
  return ctx;
}
