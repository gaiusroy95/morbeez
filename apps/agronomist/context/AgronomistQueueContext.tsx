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
import { agronomistClient, type AgronomistTaskItem } from '@morbeez/shared';
import { useStaffAuth } from '@/context/StaffAuth';

type State = {
  tasks: AgronomistTaskItem[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: (filter?: string) => Promise<void>;
};

const Ctx = createContext<State | null>(null);

export function AgronomistQueueProvider({ children }: { children: ReactNode }) {
  const { authed } = useStaffAuth();
  const [tasks, setTasks] = useState<AgronomistTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const tasksRef = useRef<AgronomistTaskItem[]>([]);
  tasksRef.current = tasks;

  const refresh = useCallback(async (filter?: string) => {
    const background = tasksRef.current.length > 0;
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const t = await agronomistClient.listTasks(filter);
      setTasks(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
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
    () => ({ tasks, loading, refreshing, error, refresh }),
    [tasks, loading, refreshing, error, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgronomistQueue(): State {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAgronomistQueue must be used within AgronomistQueueProvider');
  return ctx;
}
