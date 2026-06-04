/**
 * Staff console URL config.
 * API routes stay on the backend at `/morbeez-staff/api/v1` (unchanged).
 * The SPA is deployed separately (e.g. Vercel) at `/` with VITE_API_BASE_URL pointing at the API host.
 */

/** React Router basename — `/` on Vercel; override with VITE_BASE_PATH if needed */
export const STAFF_PORTAL_BASENAME =
  (import.meta.env.VITE_BASE_PATH as string | undefined)?.replace(/\/$/, '') || '/';

const apiOrigin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** REST API v1 — absolute in production, same-origin path in local dev (Vite proxy) */
export const STAFF_API_V1 = apiOrigin
  ? `${apiOrigin}/morbeez-staff/api/v1`
  : '/morbeez-staff/api/v1';

/** Resolve any staff API path for fetch (handles absolute paths from legacy code). */
export function resolveStaffApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (apiOrigin && path.startsWith('/')) return `${apiOrigin}${path}`;
  return path;
}
