import { useCallback, useEffect, useState } from 'react';
import { formatAppError } from '@morbeez/shared';
import { useWebOnReconnect, useWebOnline } from '../components/WebNetworkBanner';

export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = []
): {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
} {
  const isOnline = useWebOnline();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loader();
      setData(result);
    } catch (e) {
      setData(null);
      setError(formatAppError(e, isOnline));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies deps
  }, [isOnline, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useWebOnReconnect(() => {
    void reload();
  });

  return { data, loading, error, reload };
}
