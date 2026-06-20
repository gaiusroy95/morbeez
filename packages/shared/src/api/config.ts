/** Resolve API origin from Expo public env or Vite staff console env */
let apiOriginOverride = '';

/** Call from Expo app entry (e.g. _layout) so mobile builds always resolve the API host. */
export function setApiOrigin(url: string): void {
  apiOriginOverride = String(url ?? '').replace(/\/$/, '');
}

function readExpoApiBaseUrl(): string {
  if (typeof document !== 'undefined') return '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as {
      expoConfig?: { extra?: { apiBaseUrl?: string } };
      manifest2?: { extra?: { expoClient?: { extra?: { apiBaseUrl?: string } } } };
      manifest?: { extra?: { apiBaseUrl?: string } };
    };
    return String(
      Constants.expoConfig?.extra?.apiBaseUrl ??
        Constants.manifest2?.extra?.expoClient?.extra?.apiBaseUrl ??
        Constants.manifest?.extra?.apiBaseUrl ??
        ''
    );
  } catch {
    return '';
  }
}

export function getApiOrigin(): string {
  if (apiOriginOverride) return apiOriginOverride;

  let fromVite = '';
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
    if (typeof import.meta !== 'undefined' && meta.env) {
      fromVite = String(meta.env.VITE_API_BASE_URL ?? '');
    }
  } catch {
    fromVite = '';
  }

  const fromExpoExtra = readExpoApiBaseUrl();

  const raw =
    fromVite ||
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
