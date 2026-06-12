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
import { telecallerClient, EMPTY_TELECALLER_DASHBOARD, type TelecallerDashboard } from '@morbeez/shared';
import { useStaffAuth } from '@/context/StaffAuth';

type State = {
  dashboard: TelecallerDashboard | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  flushOffline: () => Promise<void>;
  offlinePending: number;
};

const Ctx = createContext<State | null>(null);

export function TelecallerDashboardProvider({ children }: { children: ReactNode }) {
  const { authed } = useStaffAuth();
  const [dashboard, setDashboard] = useState<TelecallerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offlinePending, setOfflinePending] = useState(0);
  const dashRef = useRef<TelecallerDashboard | null>(null);
  dashRef.current = dashboard;

  const refreshOfflineCount = useCallback(async () => {
    const q = await telecallerClient.listOfflineQueue();
    setOfflinePending(q.length);
  }, []);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    const background = dashRef.current != null;
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      await telecallerClient.flushOfflineQueue().catch(() => undefined);
      await refreshOfflineCount();
      const d = await telecallerClient.getDashboard({ force: opts?.force });
      setDashboard(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      setDashboard(EMPTY_TELECALLER_DASHBOARD);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshOfflineCount]);

  const flushOffline = useCallback(async () => {
    await telecallerClient.flushOfflineQueue();
    await refreshOfflineCount();
  }, [refreshOfflineCount]);

  useEffect(() => {
    if (!authed) return;
    void refresh();
  }, [authed, refresh]);

  const value = useMemo(
    () => ({ dashboard, loading, refreshing, error, refresh, flushOffline, offlinePending }),
    [dashboard, loading, refreshing, error, refresh, flushOffline, offlinePending]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTelecallerDashboard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTelecallerDashboard must be used within TelecallerDashboardProvider');
  return ctx;
}
