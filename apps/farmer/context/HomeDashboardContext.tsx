import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type HomeTrendRange = '30D' | '90D' | '1Y' | '2Y';

const STORAGE_KEY = 'morbeez_home_dashboard';

type Persisted = {
  selectedCrop: string | null;
  selectedMarket: string | null;
  selectedBlockId: string | null;
  trendRange: HomeTrendRange;
  showCurrentYear: boolean;
  showLastYear: boolean;
};

type HomeDashboardState = Persisted & {
  ready: boolean;
  setSelectedCrop: (crop: string) => void;
  setSelectedMarket: (market: string) => void;
  setSelectedBlockId: (blockId: string | null) => void;
  setTrendRange: (range: HomeTrendRange) => void;
  setShowCurrentYear: (show: boolean) => void;
  setShowLastYear: (show: boolean) => void;
  applyDefaults: (defaults: Partial<Persisted>) => void;
};

const defaults: Persisted = {
  selectedCrop: null,
  selectedMarket: null,
  selectedBlockId: null,
  trendRange: '2Y',
  showCurrentYear: true,
  showLastYear: true,
};

const HomeDashboardContext = createContext<HomeDashboardState | null>(null);

async function loadPersisted(): Promise<Persisted> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

async function savePersisted(state: Persisted): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function HomeDashboardProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<Persisted>(defaults);

  useEffect(() => {
    void loadPersisted().then((loaded) => {
      setState(loaded);
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: Persisted) => {
    setState(next);
    void savePersisted(next);
  }, []);

  const setSelectedCrop = useCallback(
    (selectedCrop: string) => {
      setState((prev) => {
        const next = { ...prev, selectedCrop };
        void savePersisted(next);
        return next;
      });
    },
    []
  );

  const setSelectedMarket = useCallback((selectedMarket: string) => {
    setState((prev) => {
      const next = { ...prev, selectedMarket };
      void savePersisted(next);
      return next;
    });
  }, []);

  const setSelectedBlockId = useCallback((selectedBlockId: string | null) => {
    setState((prev) => {
      const next = { ...prev, selectedBlockId };
      void savePersisted(next);
      return next;
    });
  }, []);

  const setTrendRange = useCallback((trendRange: HomeTrendRange) => {
    setState((prev) => {
      const next = { ...prev, trendRange };
      void savePersisted(next);
      return next;
    });
  }, []);

  const setShowCurrentYear = useCallback((showCurrentYear: boolean) => {
    setState((prev) => {
      const next = { ...prev, showCurrentYear };
      void savePersisted(next);
      return next;
    });
  }, []);

  const setShowLastYear = useCallback((showLastYear: boolean) => {
    setState((prev) => {
      const next = { ...prev, showLastYear };
      void savePersisted(next);
      return next;
    });
  }, []);

  const applyDefaults = useCallback((patch: Partial<Persisted>) => {
    setState((prev) => {
      const next = { ...prev };
      if (patch.selectedCrop != null && !prev.selectedCrop) next.selectedCrop = patch.selectedCrop;
      if (patch.selectedMarket != null && !prev.selectedMarket) next.selectedMarket = patch.selectedMarket;
      if (patch.selectedBlockId != null && !prev.selectedBlockId) next.selectedBlockId = patch.selectedBlockId;
      void savePersisted(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      ready,
      setSelectedCrop,
      setSelectedMarket,
      setSelectedBlockId,
      setTrendRange,
      setShowCurrentYear,
      setShowLastYear,
      applyDefaults,
    }),
    [
      state,
      ready,
      setSelectedCrop,
      setSelectedMarket,
      setSelectedBlockId,
      setTrendRange,
      setShowCurrentYear,
      setShowLastYear,
      applyDefaults,
    ]
  );

  return <HomeDashboardContext.Provider value={value}>{children}</HomeDashboardContext.Provider>;
}

export function useHomeDashboard(): HomeDashboardState {
  const ctx = useContext(HomeDashboardContext);
  if (!ctx) throw new Error('useHomeDashboard must be used within HomeDashboardProvider');
  return ctx;
}
