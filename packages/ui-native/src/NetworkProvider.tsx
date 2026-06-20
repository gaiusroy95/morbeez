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
import { StyleSheet, Text, View } from 'react-native';
import { formatAppError, isNetworkFailure, t, tokens, hadRecentNetworkFailure, subscribeNetworkStatus, type AppLocale } from '@morbeez/shared';

type NetworkState = {
  isOnline: boolean;
  reconnectCount: number;
};

const NetworkContext = createContext<NetworkState>({ isOnline: true, reconnectCount: 0 });

function readNetInfoOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export function NetworkProvider({ children, locale = 'en' }: { children: ReactNode; locale?: AppLocale }) {
  const [netInfoOnline, setNetInfoOnline] = useState(true);
  const [fetchUnreachable, setFetchUnreachable] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOnlineRef = useRef(true);

  const isOnline = netInfoOnline && !fetchUnreachable;

  useEffect(() => {
    const syncFetchUnreachable = () => setFetchUnreachable(hadRecentNetworkFailure());
    syncFetchUnreachable();
    return subscribeNetworkStatus(syncFetchUnreachable);
  }, []);

  useEffect(() => {
    let sub: { remove?: () => void } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const NetInfo = require('@react-native-community/netinfo').default;
      sub = NetInfo.addEventListener((state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => {
        setNetInfoOnline(readNetInfoOnline(state));
      });
      void NetInfo.fetch().then((state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => {
        setNetInfoOnline(readNetInfoOnline(state));
      });
    } catch {
      // NetInfo unavailable — assume online
    }
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    if (!wasOnlineRef.current && isOnline) {
      setReconnectCount((c) => c + 1);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 2500);
      wasOnlineRef.current = true;
      return () => clearTimeout(timer);
    }
    wasOnlineRef.current = isOnline;
    return undefined;
  }, [isOnline]);

  const value = useMemo(() => ({ isOnline, reconnectCount }), [isOnline, reconnectCount]);

  return (
    <NetworkContext.Provider value={value}>
      <OfflineBanner isOnline={isOnline} showReconnected={showReconnected} locale={locale} />
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkState {
  return useContext(NetworkContext);
}

/** Run callback when device reconnects after being offline. */
export function useOnReconnect(callback: () => void): void {
  const { reconnectCount } = useNetwork();
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const prev = useRef(reconnectCount);

  useEffect(() => {
    if (reconnectCount > prev.current) {
      prev.current = reconnectCount;
      cbRef.current();
    }
  }, [reconnectCount]);
}

/** Format caught errors for display; suppresses network errors when offline. */
export function useAppError() {
  const { isOnline } = useNetwork();
  return useCallback(
    (err: unknown, fallback = 'Something went wrong') => {
      const msg = formatAppError(err, isOnline);
      if (msg) return msg;
      if (isNetworkFailure(err)) return '';
      return fallback;
    },
    [isOnline]
  );
}

export function OfflineBanner({
  isOnline,
  showReconnected,
  locale = 'en',
}: {
  isOnline: boolean;
  showReconnected?: boolean;
  locale?: AppLocale;
}) {
  if (showReconnected) {
    return (
      <View style={[styles.banner, styles.online]}>
        <Text style={[styles.text, styles.onlineText]}>{t('onlineAgainBanner', locale)}</Text>
      </View>
    );
  }
  if (isOnline) return null;
  return (
    <View style={[styles.banner, styles.offline]}>
      <Text style={[styles.text, styles.offlineText]}>{t('noInternetBanner', locale)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 8, paddingHorizontal: 12 },
  offline: { backgroundColor: '#fef3c7' },
  online: { backgroundColor: '#dcfce7' },
  text: { fontSize: 12, textAlign: 'center', fontWeight: '600' },
  offlineText: { color: '#92400e' },
  onlineText: { color: tokens.green800 },
});
