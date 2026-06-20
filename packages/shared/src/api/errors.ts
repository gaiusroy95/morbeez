import { NetworkOfflineError } from '../network/connectivity';

export type ApiErrorBody = {
  message?: string;
  error?: string;
  hint?: string;
  issues?: Array<{ message?: string; path?: (string | number)[] }>;
};

export function parseApiError(data: ApiErrorBody, statusText: string): string {
  let msg = data.message || data.error || statusText || 'Request failed';
  if (data.hint) msg = `${msg} — ${data.hint}`;
  if (data.error === 'VALIDATION_ERROR' && data.message) msg = data.message;
  if (data.error === 'NOT_FOUND' && msg === 'API route not found') {
    msg = 'API route not found. Check EXPO_PUBLIC_API_BASE_URL and that the backend is running.';
  }
  if (data.error === 'DATABASE_SCHEMA') msg = data.message ?? msg;
  return msg;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Turn React Native / fetch network failures into actionable messages. */
export function formatFetchError(err: unknown, _apiOrigin?: string): Error {
  const raw = err instanceof Error ? err.message : String(err);

  if (/UnknownHostException|Unable to resolve host|ENOTFOUND|getaddrinfo|No address associated with hostname|Network request failed|Failed to fetch|fetch failed/i.test(raw)) {
    return new NetworkOfflineError('No internet connection');
  }
  if (/AbortError|timed out|timeout/i.test(raw)) {
    return new NetworkOfflineError('Connection timed out. Check your internet and try again.');
  }
  if (err instanceof NetworkOfflineError) return err;
  if (err instanceof Error) return err;
  return new Error(raw || 'Request failed');
}
