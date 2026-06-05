import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { STAFF_API_V1, resolveStaffApiUrl } from './staff-portal';

const TOKEN_KEY = 'morbeez_admin_token';

/** SecureStore is unavailable on web dev — fall back to sessionStorage there only. */
async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export type ApiModule = {
  moduleKey: string;
  canRead: boolean;
  canWrite: boolean;
};

export type SessionAdmin = {
  id: string;
  email: string;
  role: string;
  fullName?: string;
};

export type SessionPayload = {
  admin: SessionAdmin & { agronomistTier?: 'new' | 'experienced' | null };
  modules: ApiModule[];
  canApproveRecommendations: boolean;
  canSelfApproveRecommendations: boolean;
};

export async function getToken(): Promise<string | null> {
  return getStoredToken();
}

export async function setToken(token: string): Promise<void> {
  await setStoredToken(token);
}

export async function clearToken(): Promise<void> {
  await clearStoredToken();
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body != null && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(resolveStaffApiUrl(path), { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    const body = data as { message?: string; error?: string };
    throw new Error(body.message || body.error || res.statusText || 'Request failed');
  }
  return data;
}

export async function login(email: string, password: string) {
  const data = await api<{
    ok: boolean;
    token: string;
    admin: SessionAdmin & { fullName?: string };
  }>(`${STAFF_API_V1}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setToken(data.token);
  return data;
}

export async function fetchSession(): Promise<SessionPayload> {
  const data = await api<{
    ok: boolean;
    admin: SessionAdmin & { fullName?: string };
    modules: ApiModule[];
    canApproveRecommendations: boolean;
    canSelfApproveRecommendations?: boolean;
  }>(`${STAFF_API_V1}/auth/me`);
  return {
    admin: data.admin,
    modules: data.modules ?? [],
    canApproveRecommendations: Boolean(data.canApproveRecommendations),
    canSelfApproveRecommendations: Boolean(data.canSelfApproveRecommendations),
  };
}

export function canAccess(modules: ApiModule[], key: string, mode: 'read' | 'write' = 'read') {
  const row = modules.find((m) => m.moduleKey === key);
  if (!row) return false;
  return mode === 'write' ? row.canWrite : row.canRead || row.canWrite;
}
