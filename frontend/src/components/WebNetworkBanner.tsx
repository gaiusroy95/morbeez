import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  formatAppError,
  hadRecentNetworkFailure,
  isNetworkFailureMessage,
  readWebOnline,
  subscribeNetworkStatus,
  t,
} from '@morbeez/shared';

type WebNetworkState = {
  isOnline: boolean;
  reconnectCount: number;
};

const WebNetworkContext = createContext<WebNetworkState>({ isOnline: true, reconnectCount: 0 });

export function useWebOnline(): boolean {
  return useContext(WebNetworkContext).isOnline;
}

export function useWebOnReconnect(callback: () => void): void {
  const { reconnectCount } = useContext(WebNetworkContext);
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

export function useWebAppError() {
  const isOnline = useWebOnline();
  return useCallback(
    (err: unknown, fallback = 'Something went wrong') => {
      const msg = formatAppError(err, isOnline);
      return msg || fallback;
    },
    [isOnline]
  );
}

export function WebNetworkProvider({ children }: { children: ReactNode }) {
  const [browserOnline, setBrowserOnline] = useState(readWebOnline);
  const [fetchUnreachable, setFetchUnreachable] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const wasOnlineRef = useRef(true);

  const isOnline = browserOnline && !fetchUnreachable;

  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    const syncFetchUnreachable = () => setFetchUnreachable(hadRecentNetworkFailure());
    syncFetchUnreachable();
    return subscribeNetworkStatus(syncFetchUnreachable);
  }, []);

  useEffect(() => {
    if (!wasOnlineRef.current && isOnline) {
      setReconnectCount((c) => c + 1);
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  const value = useMemo(() => ({ isOnline, reconnectCount }), [isOnline, reconnectCount]);

  return <WebNetworkContext.Provider value={value}>{children}</WebNetworkContext.Provider>;
}

export function WebNetworkBanner() {
  const isOnline = useWebOnline();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
      return;
    }
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    setShowReconnected(true);
    const timer = window.setTimeout(() => setShowReconnected(false), 2500);
    return () => window.clearTimeout(timer);
  }, [isOnline]);

  if (showReconnected && isOnline) {
    return (
      <div
        style={{
          background: '#dcfce7',
          color: '#166534',
          padding: '8px 12px',
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {t('onlineAgainBanner')}
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div
      style={{
        background: '#fef3c7',
        color: '#92400e',
        padding: '8px 12px',
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {t('noInternetBanner')}
    </div>
  );
}

export { isNetworkFailureMessage, formatAppError };
