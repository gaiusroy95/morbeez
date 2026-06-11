import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { agronomistClient, type AgronomistDashboard } from '@morbeez/shared';
import { useStaffAuth } from '@/context/StaffAuth';

type State = {
  dashboard: AgronomistDashboard | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
};

const Ctx = createContext<State | null>(null);

export function AgronomistDashboardProvider({ children }: { children: ReactNode }) {
  const { authed } = useStaffAuth();
  const [dashboard, setDashboard] = useState<AgronomistDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const dashRef = useRef<AgronomistDashboard | null>(null);
  dashRef.current = dashboard;

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    const background = dashRef.current != null;
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const d = await agronomistClient.getDashboard({ force: opts?.force });
      setDashboard(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void refresh();
  }, [authed, refresh]);

  const value = useMemo(
    () => ({ dashboard, loading, refreshing, error, refresh }),
    [dashboard, loading, refreshing, error, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgronomistDashboard(): State {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAgronomistDashboard must be used within AgronomistDashboardProvider');
  return ctx;
}
