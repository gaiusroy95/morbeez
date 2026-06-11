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
import { warehouseClient, type QueueOrder, type WarehouseStats } from '@morbeez/shared';

type WarehouseQueueState = {
  queue: QueueOrder[];
  stats: WarehouseStats | null;
  queueLoading: boolean;
  statsLoading: boolean;
  refreshing: boolean;
  error: string;
  refreshQueue: (opts?: { repair?: boolean; force?: boolean }) => Promise<void>;
  refreshStats: (opts?: { force?: boolean }) => Promise<void>;
};

const WarehouseQueueContext = createContext<WarehouseQueueState | null>(null);

export function WarehouseQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueOrder[]>([]);
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
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setQueueLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshStats = useCallback(async (opts?: { force?: boolean }) => {
    const background = statsRef.current != null;
    if (!background) setStatsLoading(true);
    try {
      const s = await warehouseClient.getStats({ force: opts?.force });
      setStats(s);
    } catch (e) {
      if (!background) {
        setError(e instanceof Error ? e.message : 'Failed to load stats');
      }
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
    void refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const value = useMemo(
    () => ({
      queue,
      stats,
      queueLoading,
      statsLoading,
      refreshing,
      error,
      refreshQueue,
      refreshStats,
    }),
    [queue, stats, queueLoading, statsLoading, refreshing, error, refreshQueue, refreshStats]
  );

  return <WarehouseQueueContext.Provider value={value}>{children}</WarehouseQueueContext.Provider>;
}

export function useWarehouseQueue(): WarehouseQueueState {
  const ctx = useContext(WarehouseQueueContext);
  if (!ctx) throw new Error('useWarehouseQueue must be used within WarehouseQueueProvider');
  return ctx;
}
