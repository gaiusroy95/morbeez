import { deleteSessionItem, readSessionItem, writeSessionItem } from './secure-storage';
import { parseApiError } from './errors';
import { STAFF_API_V1, getApiOrigin, resolveStaffApiUrl } from './config';

export const STAFF_TOKEN_KEY = 'morbeez_admin_token';

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
  agronomistTier?: 'new' | 'experienced' | null;
  hasPassword?: boolean;
};

export type SessionPayload = {
  admin: SessionAdmin;
  modules: ApiModule[];
  canApproveRecommendations: boolean;
  canSelfApproveRecommendations: boolean;
};

async function getStoredToken(): Promise<string | null> {
  return readSessionItem(STAFF_TOKEN_KEY);
}

async function setStoredToken(token: string): Promise<void> {
  await writeSessionItem(STAFF_TOKEN_KEY, token);
}

async function clearStoredToken(): Promise<void> {
  await deleteSessionItem(STAFF_TOKEN_KEY);
}

export async function getStaffToken(): Promise<string | null> {
  return getStoredToken();
}

export async function setStaffToken(token: string): Promise<void> {
  await setStoredToken(token);
}

export async function clearStaffToken(): Promise<void> {
  await clearStoredToken();
}

export async function staffApi<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const origin = getApiOrigin();
  if (!origin) {
    throw new Error(
      'API URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in apps/warehouse/.env (local) or eas.json (builds).'
    );
  }
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body != null && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = path.startsWith(STAFF_API_V1)
    ? resolveStaffApiUrl(path)
    : resolveStaffApiUrl(`${STAFF_API_V1}${path.startsWith('/') ? path : `/${path}`}`);

  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };

  if (!res.ok) {
    throw new Error(parseApiError(data, res.statusText));
  }
  return data;
}

/** Sign in with work email or mobile + password (email if identifier contains `@`). */
export async function staffLogin(identifier: string, password: string) {
  const trimmed = identifier.trim();
  if (!trimmed) throw new Error('Email is required');
  const body = trimmed.includes('@')
    ? { email: trimmed, password }
    : { phone: trimmed, password };

  const data = await staffApi<{
    ok: boolean;
    token: string;
    admin: SessionAdmin;
  }>(`${STAFF_API_V1}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  await setStaffToken(data.token);
  return data;
}

export async function sendStaffOtp(phone: string) {
  return staffApi<{ ok: boolean; sent: boolean; expiresInSeconds: number; devOtp?: string }>(
    `${STAFF_API_V1}/auth/otp/send`,
    { method: 'POST', body: JSON.stringify({ phone }) }
  );
}

export async function verifyStaffOtp(phone: string, code: string) {
  const data = await staffApi<{
    ok: boolean;
    token: string;
    admin: SessionAdmin;
  }>(`${STAFF_API_V1}/auth/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
  await setStaffToken(data.token);
  return data;
}

export async function fetchStaffSession(): Promise<SessionPayload> {
  const data = await staffApi<{
    ok: boolean;
    admin: SessionAdmin;
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

export async function changeStaffPassword(input: {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return staffApi<{ ok: boolean; hasPassword: boolean }>(`${STAFF_API_V1}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function canAccessModule(
  modules: ApiModule[],
  key: string,
  mode: 'read' | 'write' = 'read'
): boolean {
  const row = modules.find((m) => m.moduleKey === key);
  if (!row) return false;
  return mode === 'write' ? row.canWrite : row.canRead || row.canWrite;
}

/** Reject login when user lacks required module (per-app guard) */
export function assertModuleAccess(
  modules: ApiModule[],
  requiredModule: string,
  mode: 'read' | 'write' = 'read'
): void {
  if (!canAccessModule(modules, requiredModule, mode)) {
    throw new Error(`Your account does not have access to this app (${requiredModule}).`);
  }
}
