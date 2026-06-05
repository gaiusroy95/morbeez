/**
 * Staff API URL — same backend routes as the web console (`frontend/`).
 * Web uses VITE_API_BASE_URL; mobile uses EXPO_PUBLIC_API_BASE_URL.
 */

const apiOrigin = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

export const STAFF_API_V1 = apiOrigin
  ? `${apiOrigin}/morbeez-staff/api/v1`
  : 'http://localhost:3000/morbeez-staff/api/v1';

export function resolveStaffApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (apiOrigin && path.startsWith('/')) return `${apiOrigin}${path}`;
  if (!apiOrigin && path.startsWith('/morbeez-staff/')) {
    return `http://localhost:3000${path}`;
  }
  return path.startsWith('/') ? `${STAFF_API_V1.replace(/\/api\/v1$/, '')}${path}` : path;
}
