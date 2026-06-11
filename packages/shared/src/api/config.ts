/** Resolve API origin from Expo public env (set per app in .env) */
export function getApiOrigin(): string {
  let fromExpoExtra = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as {
      expoConfig?: { extra?: { apiBaseUrl?: string } };
    };
    fromExpoExtra = String(Constants.expoConfig?.extra?.apiBaseUrl ?? '');
  } catch {
    fromExpoExtra = '';
  }

  const raw =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) ||
    fromExpoExtra ||
    '';
  return String(raw).replace(/\/$/, '');
}

export const STAFF_API_V1 = '/morbeez-staff/api/v1';

export function resolveStaffApiUrl(path: string): string {
  const origin = getApiOrigin();
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (origin && path.startsWith('/')) return `${origin}${path}`;
  if (origin && !path.startsWith('/')) return `${origin}${path}`;
  return path;
}

export function resolveApiUrl(path: string): string {
  const origin = getApiOrigin();
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (origin) return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  return path;
}
