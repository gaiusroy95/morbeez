import Constants from 'expo-constants';
import { setApiOrigin } from '@morbeez/shared';

const DEFAULT_API = 'https://morbeez-api-5hbx.onrender.com';

/** Pin API origin at app boot — avoids empty/wrong host in React Native fetch. */
export function initAgronomistApiConfig(): void {
  let fromExpo = '';
  try {
    fromExpo = String(Constants.expoConfig?.extra?.apiBaseUrl ?? '');
  } catch {
    fromExpo = '';
  }
  const url = process.env.EXPO_PUBLIC_API_BASE_URL || fromExpo || DEFAULT_API;
  setApiOrigin(url);
}

export function agronomistApiOrigin(): string {
  let fromExpo = '';
  try {
    fromExpo = String(Constants.expoConfig?.extra?.apiBaseUrl ?? '');
  } catch {
    fromExpo = '';
  }
  return (process.env.EXPO_PUBLIC_API_BASE_URL || fromExpo || DEFAULT_API).replace(/\/$/, '');
}
