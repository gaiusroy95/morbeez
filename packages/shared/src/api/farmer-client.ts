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
import type {
  CheckoutCreateInput,
  CheckoutCreateResult,
  CheckoutVerifyResult,
  ProductReviewAggregate,
  StoreProduct,
  StoreProductList,
} from '../types/store';
import type { FieldBlock, FieldDetail } from '../types/fields';
import type { ScanResult } from '../types/scan';
import type { CultivationActivity } from '../types/activities';
import type { FarmerRecommendation, RecommendationDetail } from '../types/recommendations';
import type {
  MarketIntel,
  PortalNotification,
  RoiDashboard,
  WeatherIntel,
} from '../types/intel';

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

export async function fetchStoreProducts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}): Promise<StoreProductList> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search?.trim()) qs.set('search', params.search.trim());
  if (params?.category?.trim()) qs.set('category', params.category.trim());
  const q = qs.toString();
  const data = await farmerApi<{ ok: boolean } & StoreProductList>(
    `/api/v1/store/products${q ? `?${q}` : ''}`
  );
  return {
    products: data.products ?? [],
    categories: data.categories ?? [],
    pagination: data.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 },
  };
}

export async function fetchStoreProduct(id: string): Promise<StoreProduct> {
  const data = await farmerApi<{ ok: boolean; product: StoreProduct }>(
    `/api/v1/store/products/${encodeURIComponent(id)}`
  );
  return data.product;
}

export async function fetchProductReviews(productId: string): Promise<ProductReviewAggregate> {
  const data = await farmerApi<{ ok: boolean } & ProductReviewAggregate>(
    `/api/v1/store/product-reviews?productId=${encodeURIComponent(productId)}`
  );
  return {
    averageRating: data.averageRating ?? 0,
    reviewCount: data.reviewCount ?? 0,
    reviews: data.reviews ?? [],
  };
}

export async function fetchCheckoutConfig(): Promise<{ keyId: string; currency: string }> {
  const data = await farmerApi<{ ok: boolean; keyId: string; currency: string }>(
    '/api/v1/checkout/razorpay/config'
  );
  return { keyId: data.keyId, currency: data.currency ?? 'INR' };
}

export async function createCheckout(body: CheckoutCreateInput): Promise<CheckoutCreateResult> {
  const data = await farmerApi<{ ok: boolean } & CheckoutCreateResult>(
    '/api/v1/checkout/razorpay/create',
    {
      method: 'POST',
      body: JSON.stringify({ channel: 'mobile', ...body }),
    }
  );
  return data;
}

export async function verifyCheckout(body: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<CheckoutVerifyResult> {
  const data = await farmerApi<{ ok: boolean } & CheckoutVerifyResult>(
    '/api/v1/checkout/razorpay/verify',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return data;
}

export async function fetchPortalNotifications(): Promise<PortalNotification[]> {
  const data = await farmerApi<{ ok: boolean; notifications: PortalNotification[] }>(
    '/api/v1/farmer/portal/notifications'
  );
  return data.notifications ?? [];
}

export async function fetchFieldBlocks(): Promise<FieldBlock[]> {
  const data = await farmerApi<{ ok: boolean; blocks: FieldBlock[] }>('/api/v1/farmer/portal/blocks');
  return data.blocks ?? [];
}

export async function createFieldBlock(body: {
  name: string;
  cropType: string;
  acreage?: number;
  plantingDate?: string;
  irrigationType?: string;
}): Promise<FieldBlock> {
  const data = await farmerApi<{ ok: boolean; block: FieldBlock }>('/api/v1/farmer/portal/blocks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.block;
}

export async function fetchFieldDetail(blockId: string): Promise<FieldDetail> {
  const data = await farmerApi<{ ok: boolean } & FieldDetail>(
    `/api/v1/farmer/portal/blocks/${encodeURIComponent(blockId)}`
  );
  return { block: data.block, timeline: data.timeline ?? [] };
}

export async function runAiScan(body: {
  blockId?: string;
  scanType: 'leaf' | 'field' | 'rhizome';
  imageData: string;
  mimeType?: string;
}): Promise<ScanResult> {
  const data = await farmerApi<{ ok: boolean } & ScanResult>('/api/v1/farmer/portal/scan', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}

export async function fetchAiScan(sessionId: string): Promise<ScanResult> {
  const data = await farmerApi<{ ok: boolean } & ScanResult>(
    `/api/v1/farmer/portal/scan/${encodeURIComponent(sessionId)}`
  );
  return data;
}

export async function fetchRecommendations(): Promise<FarmerRecommendation[]> {
  const data = await farmerApi<{ ok: boolean; recommendations: FarmerRecommendation[] }>(
    '/api/v1/farmer/portal/recommendations'
  );
  return data.recommendations ?? [];
}

export async function fetchRecommendationDetail(id: string): Promise<RecommendationDetail> {
  const data = await farmerApi<{ ok: boolean; recommendation: RecommendationDetail }>(
    `/api/v1/farmer/portal/recommendations/${encodeURIComponent(id)}`
  );
  return data.recommendation;
}

export async function markRecommendationApplied(id: string): Promise<void> {
  await farmerApi(`/api/v1/farmer/portal/recommendations/${encodeURIComponent(id)}/applied`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchActivities(params?: {
  blockId?: string;
  type?: string;
  from?: string;
  to?: string;
}): Promise<CultivationActivity[]> {
  const qs = new URLSearchParams();
  if (params?.blockId) qs.set('blockId', params.blockId);
  if (params?.type) qs.set('type', params.type);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const q = qs.toString();
  const data = await farmerApi<{ ok: boolean; activities: CultivationActivity[] }>(
    `/api/v1/farmer/portal/activities${q ? `?${q}` : ''}`
  );
  return data.activities ?? [];
}

export async function createActivity(body: {
  blockId: string;
  activityType: 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'irrigation' | 'other';
  activityDate: string;
  productUsed?: string;
  quantity?: string;
  notes?: string;
  costInr?: number;
}): Promise<CultivationActivity[]> {
  const data = await farmerApi<{ ok: boolean; activities: CultivationActivity[] }>(
    '/api/v1/farmer/portal/activities',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return data.activities ?? [];
}

export async function createRoiEntry(body: {
  entryType: 'labour' | 'purchase' | 'misc' | 'harvest' | 'income';
  amount: number;
  entryDate: string;
  comments?: string;
}): Promise<{ id: string }> {
  const data = await farmerApi<{ ok: boolean; id: string }>('/api/v1/farmer/portal/roi/entries', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { id: data.id };
}

export async function fetchWeatherIntel(blockId?: string): Promise<WeatherIntel> {
  const q = blockId ? `?blockId=${encodeURIComponent(blockId)}` : '';
  const data = await farmerApi<{ ok: boolean; weather: WeatherIntel }>(
    `/api/v1/farmer/portal/weather${q}`
  );
  return data.weather;
}

export async function fetchMarketIntel(crop?: string): Promise<MarketIntel> {
  const q = crop ? `?crop=${encodeURIComponent(crop)}` : '';
  const data = await farmerApi<{ ok: boolean; market: MarketIntel }>(
    `/api/v1/farmer/portal/market-prices${q}`
  );
  return data.market;
}

export async function fetchRoiDashboard(): Promise<RoiDashboard> {
  const data = await farmerApi<{ ok: boolean; dashboard: RoiDashboard }>(
    '/api/v1/farmer/portal/roi/dashboard'
  );
  return data.dashboard;
}
