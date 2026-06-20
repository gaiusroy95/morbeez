import { formatFetchError } from '../api/errors.js';
import { notifyNetworkFailure, notifyNetworkSuccess } from './connectivity.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch with short retries; throws NetworkOfflineError on connectivity failures. */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  apiOrigin?: string
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      notifyNetworkSuccess();
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(1200 * (attempt + 1));
    }
  }
  notifyNetworkFailure();
  throw formatFetchError(lastErr, apiOrigin);
}
