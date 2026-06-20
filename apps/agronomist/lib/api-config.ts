import Constants from 'expo-constants';
import { setApiOrigin } from '@morbeez/shared';

const DEFAULT_API = 'https://morbeez-api-5hbx.onrender.com';

/** Pin API origin at app boot — avoids empty/wrong host in React Native fetch. */
export function initAgronomistApiConfig(): void {
  const url =
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    DEFAULT_API;
  setApiOrigin(url);
}

export function agronomistApiOrigin(): string {
  return (
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    DEFAULT_API
  ).replace(/\/$/, '');
}
