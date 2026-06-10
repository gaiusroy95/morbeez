import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { parseApiError } from './errors';
import { resolveApiUrl } from './config';
import type {
  FarmerProfile,
  PortalAdvisory,
  PortalOrder,
  PortalRoi,
  PortalSoilReport,
  PortalSummary,
  PortalTracking,
} from '../types/farmer-portal';

export const FARMER_TOKEN_KEY = 'morbeez_farmer_token';

export type { FarmerProfile } from '../types/farmer-portal';

async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return sessionStorage.getItem(FARMER_TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(FARMER_TOKEN_KEY);
}

async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.setItem(FARMER_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(FARMER_TOKEN_KEY, token);
}

async function clearStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.removeItem(FARMER_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(FARMER_TOKEN_KEY);
}

export async function getFarmerToken(): Promise<string | null> {
  return getStoredToken();
}

export async function setFarmerToken(token: string): Promise<void> {
  await setStoredToken(token);
}

export async function clearFarmerToken(): Promise<void> {
  await clearStoredToken();
}

export async function farmerApi<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (options.body != null && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = resolveApiUrl(path);
  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };

  if (!res.ok) {
    throw new Error(parseApiError(data, res.statusText));
  }
  return data;
}

export async function farmerLogin(email: string, password: string) {
  const data = await farmerApi<{ ok: boolean; token: string; farmer: FarmerProfile }>(
    '/api/v1/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  );
  await setFarmerToken(data.token);
  return data;
}

export async function farmerSignup(body: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  acceptTerms: true;
  newsletter?: boolean;
}) {
  const data = await farmerApi<{ ok: boolean; token: string; farmer: FarmerProfile }>(
    '/api/v1/auth/signup',
    { method: 'POST', body: JSON.stringify({ ...body, channel: 'mobile' }) }
  );
  await setFarmerToken(data.token);
  return data;
}

export async function fetchFarmerMe(): Promise<FarmerProfile> {
  const data = await farmerApi<{ ok: boolean; farmer: FarmerProfile }>('/api/v1/auth/me');
  return data.farmer;
}

export async function fetchPortalSummary(): Promise<PortalSummary> {
  const data = await farmerApi<{ ok: boolean } & PortalSummary>('/api/v1/farmer/portal/summary');
  return data;
}

export async function fetchPortalOrders(): Promise<PortalOrder[]> {
  const data = await farmerApi<{ ok: boolean; orders: PortalOrder[] }>('/api/v1/farmer/portal/orders');
  return data.orders ?? [];
}

export async function fetchPortalAdvisory(): Promise<PortalAdvisory> {
  const data = await farmerApi<{ ok: boolean } & PortalAdvisory>('/api/v1/farmer/portal/advisory');
  return data;
}

export async function fetchPortalSoilReports(): Promise<PortalSoilReport[]> {
  const data = await farmerApi<{ ok: boolean; reports: PortalSoilReport[] }>(
    '/api/v1/farmer/portal/soil-reports'
  );
  return data.reports ?? [];
}

export async function fetchPortalRoi(): Promise<PortalRoi> {
  const data = await farmerApi<{ ok: boolean } & PortalRoi>('/api/v1/farmer/portal/roi');
  return data;
}

export async function fetchPortalProfile(): Promise<FarmerProfile> {
  const data = await farmerApi<{ ok: boolean; profile: FarmerProfile }>('/api/v1/farmer/portal/profile');
  return data.profile;
}

export async function updatePortalAddress(body: {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}) {
  return farmerApi<{ ok: boolean; profile: FarmerProfile }>('/api/v1/farmer/portal/address', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchOrderTracking(orderId: string): Promise<PortalTracking> {
  return farmerApi<PortalTracking>(`/api/v1/farmer/portal/orders/${encodeURIComponent(orderId)}/tracking`);
}

export async function submitOrderReview(
  orderId: string,
  body: { productKey: string; rating: number; reviewText?: string }
) {
  return farmerApi(`/api/v1/farmer/portal/orders/${encodeURIComponent(orderId)}/reviews`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadFieldPhoto(body: {
  photoType: 'field' | 'leaf' | 'rhizome';
  imageData: string;
  mimeType?: string;
  notes?: string;
}) {
  return farmerApi('/api/v1/farmer/portal/field-photos', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
