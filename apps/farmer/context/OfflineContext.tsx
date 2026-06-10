import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = 'morbeez_offline_';

type OfflineState = {
  isOnline: boolean;
  lastUpdated: string | null;
  cacheGet: <T>(key: string) => Promise<T | null>;
  cacheSet: <T>(key: string, value: T) => Promise<void>;
};

const OfflineContext = createContext<OfflineState | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    void NetInfo.fetch().then((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => sub();
  }, []);

  const cacheGet = useCallback(async <T,>(key: string): Promise<T | null> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { at: string; data: T };
      setLastUpdated(parsed.at);
      return parsed.data;
    } catch {
      return null;
    }
  }, []);

  const cacheSet = useCallback(async <T,>(key: string, value: T) => {
    const at = new Date().toISOString();
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at, data: value }));
    setLastUpdated(at);
  }, []);

  const value = useMemo(
    () => ({ isOnline, lastUpdated, cacheGet, cacheSet }),
    [isOnline, lastUpdated, cacheGet, cacheSet]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineState {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}

export function OfflineBanner() {
  const { isOnline, lastUpdated } = useOffline();
  if (isOnline) return null;
  return (
    <Text style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: 8, textAlign: 'center', fontSize: 12 }}>
      Offline — showing last saved data{lastUpdated ? ` · ${new Date(lastUpdated).toLocaleString('en-IN')}` : ''}
    </Text>
  );
}
