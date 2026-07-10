import Constants from 'expo-constants';
import { setApiOrigin } from '@morbeez/shared';

const DEFAULT_API = 'https://morbeez-api-5hbx.onrender.com';

/**
 * Pin API origin at app boot.
 * Must run before any staff/telecaller API call — otherwise shared getApiOrigin()
 * may touch Constants.manifest and crash Expo Go (Updates launcher not ready).
 */
export function initTelecallerApiConfig(): void {
  let fromExpo = '';
  try {
    fromExpo = String(Constants.expoConfig?.extra?.apiBaseUrl ?? '');
  } catch {
    fromExpo = '';
  }

  const url =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    fromExpo ||
    DEFAULT_API;
  setApiOrigin(url);
}

// Side-effect: pin origin as soon as this module is imported.
initTelecallerApiConfig();
