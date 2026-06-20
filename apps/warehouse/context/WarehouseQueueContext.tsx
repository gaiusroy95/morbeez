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
import {
  warehouseClient,
  formatAppError,
  type QueueOrder,
  type WarehouseCompletedToday,
  type WarehouseStats,
} from '@morbeez/shared';
import { useNetwork, useOnReconnect } from '@morbeez/ui-native';

type WarehouseQueueState = {
  queue: QueueOrder[];
  completedToday: WarehouseCompletedToday;
  stats: WarehouseStats | null;
  queueLoading: boolean;
  statsLoading: boolean;
  refreshing: boolean;
  error: string;
  refreshQueue: (opts?: { repair?: boolean; force?: boolean }) => Promise<void>;
  refreshStats: (opts?: { force?: boolean }) => Promise<void>;
  refreshCompletedToday: (opts?: { force?: boolean }) => Promise<void>;
};

const EMPTY_COMPLETED: WarehouseCompletedToday = { packedToday: [], handedOverToday: [] };

const WarehouseQueueContext = createContext<WarehouseQueueState | null>(null);

export function WarehouseQueueProvider({ children }: { children: ReactNode }) {
  const { isOnline } = useNetwork();
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [completedToday, setCompletedToday] = useState<WarehouseCompletedToday>(EMPTY_COMPLETED);
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const queueRef = useRef<QueueOrder[]>([]);
  const statsRef = useRef<WarehouseStats | null>(null);
  queueRef.current = queue;
  statsRef.current = stats;

  const refreshQueue = useCallback(async (opts?: { repair?: boolean; force?: boolean }) => {
    const background = queueRef.current.length > 0;
    if (!background) setQueueLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const q = await warehouseClient.getQueue({
        limit: 80,
        repair: opts?.repair,
        force: opts?.force,
      });
      setQueue(q);
    } catch (e) {
      setError(formatAppError(e, isOnline));
    } finally {
      setQueueLoading(false);
      setRefreshing(false);
    }
  }, [isOnline]);

  const refreshStats = useCallback(async (opts?: { force?: boolean }) => {
    const background = statsRef.current != null;
    if (!background) setStatsLoading(true);
    try {
      const s = await warehouseClient.getStats({ force: opts?.force });
      setStats(s);
    } catch (e) {
      if (!background) {
        setError(formatAppError(e, isOnline));
      }
    } finally {
      setStatsLoading(false);
    }
  }, [isOnline]);

  const refreshCompletedToday = useCallback(async (opts?: { force?: boolean }) => {
    try {
      const result = await warehouseClient.getCompletedToday({ limit: 50, force: opts?.force });
      setCompletedToday(result);
    } catch {
      // Non-blocking — stats still show counts
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
    void refreshStats();
    void refreshCompletedToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useOnReconnect(() => {
    void refreshQueue({ force: true });
    void refreshStats({ force: true });
    void refreshCompletedToday({ force: true });
  });

  const value = useMemo(
    () => ({
      queue,
      completedToday,
      stats,
      queueLoading,
      statsLoading,
      refreshing,
      error,
      refreshQueue,
      refreshStats,
      refreshCompletedToday,
    }),
    [
      queue,
      completedToday,
      stats,
      queueLoading,
      statsLoading,
      refreshing,
      error,
      refreshQueue,
      refreshStats,
      refreshCompletedToday,
    ]
  );

  return <WarehouseQueueContext.Provider value={value}>{children}</WarehouseQueueContext.Provider>;
}

export function useWarehouseQueue(): WarehouseQueueState {
  const ctx = useContext(WarehouseQueueContext);
  if (!ctx) throw new Error('useWarehouseQueue must be used within WarehouseQueueProvider');
  return ctx;
}
