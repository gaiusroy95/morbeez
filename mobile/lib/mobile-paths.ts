import { getRoleHomePath } from './role-home';
import type { Href } from 'expo-router';

/** Map web console paths (`/dashboard`) to Expo Router hrefs. */
export function webPathToExpoRoute(path: string): Href {
  const segment = path.startsWith('/') ? path : `/${path}`;
  return `/(app)${segment}` as Href;
}

export function roleHomeExpoRoute(role: string | undefined | null): Href {
  return webPathToExpoRoute(getRoleHomePath(role));
}
