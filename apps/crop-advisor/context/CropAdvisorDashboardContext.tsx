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
import { cropAdvisorClient, EMPTY_CROP_ADVISOR_DASHBOARD, formatAppError, type CropAdvisorDashboard } from '@morbeez/shared';
import { useNetwork, useOnReconnect } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

type State = {
  dashboard: CropAdvisorDashboard | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  flushOffline: () => Promise<void>;
  offlinePending: number;
};

const Ctx = createContext<State | null>(null);

export function CropAdvisorDashboardProvider({ children }: { children: ReactNode }) {
  const { authed } = useStaffAuth();
  const { isOnline } = useNetwork();
  const [dashboard, setDashboard] = useState<CropAdvisorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offlinePending, setOfflinePending] = useState(0);
  const dashRef = useRef<CropAdvisorDashboard | null>(null);
  dashRef.current = dashboard;

  const refreshOfflineCount = useCallback(async () => {
    const q = await cropAdvisorClient.listOfflineQueue();
    setOfflinePending(q.length);
  }, []);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    const background = dashRef.current != null;
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      await cropAdvisorClient.flushOfflineQueue().catch(() => undefined);
      await refreshOfflineCount();
      const d = await cropAdvisorClient.getDashboard({ force: opts?.force });
      setDashboard(d);
    } catch (e) {
      setError(formatAppError(e, isOnline));
      if (isOnline) setDashboard(EMPTY_CROP_ADVISOR_DASHBOARD);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshOfflineCount, isOnline]);

  useOnReconnect(() => {
    if (authed) void refresh({ force: true });
  });

  const flushOffline = useCallback(async () => {
    await cropAdvisorClient.flushOfflineQueue();
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

export function useCropAdvisorDashboard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCropAdvisorDashboard must be used within CropAdvisorDashboardProvider');
  return ctx;
}
