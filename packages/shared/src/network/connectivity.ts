export const NETWORK_OFFLINE_CODE = 'NETWORK_OFFLINE';

export class NetworkOfflineError extends Error {
  readonly code = NETWORK_OFFLINE_CODE;

  constructor(message = 'No internet connection') {
    super(message);
    this.name = 'NetworkOfflineError';
  }
}

const NETWORK_MSG_RE =
  /UnknownHostException|Unable to resolve host|ENOTFOUND|getaddrinfo|No address associated with hostname|Network request failed|Failed to fetch|fetch failed|NETWORK_OFFLINE|No internet connection/i;

const networkStatusListeners = new Set<() => void>();
let lastNetworkFailureAt = 0;

export function notifyNetworkFailure(): void {
  lastNetworkFailureAt = Date.now();
  networkStatusListeners.forEach((fn) => fn());
}

export function notifyNetworkSuccess(): void {
  if (lastNetworkFailureAt === 0) return;
  lastNetworkFailureAt = 0;
  networkStatusListeners.forEach((fn) => fn());
}

export function subscribeNetworkStatus(listener: () => void): () => void {
  networkStatusListeners.add(listener);
  return () => networkStatusListeners.delete(listener);
}

export function hadRecentNetworkFailure(withinMs = 45_000): boolean {
  return lastNetworkFailureAt > 0 && Date.now() - lastNetworkFailureAt < withinMs;
}

export function isEffectivelyOnline(netInfoOnline: boolean): boolean {
  return netInfoOnline && !hadRecentNetworkFailure();
}

export function isNetworkFailureMessage(message: string): boolean {
  return NETWORK_MSG_RE.test(message);
}

export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof NetworkOfflineError) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return isNetworkFailureMessage(msg);
}

/** User-facing error text; returns empty when offline + network error (banner handles UX). */
export function formatAppError(err: unknown, isOnline: boolean): string {
  const effectivelyOnline = isEffectivelyOnline(isOnline);
  if (isNetworkFailure(err)) {
    return effectivelyOnline ? 'Cannot reach server. Check your connection and try again.' : '';
  }
  const msg = err instanceof Error ? err.message : String(err ?? 'Something went wrong');
  if (!effectivelyOnline && isNetworkFailureMessage(msg)) return '';
  return msg.trim();
}

export function readWebOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}
