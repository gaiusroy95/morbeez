import { deletePersistedItem, readPersistedItem, writePersistedItem } from './secure-storage';
import { parseApiError } from './errors';
import { fetchWithRetry } from '../network/fetch.js';
import { getApiOrigin, resolveApiUrl } from './config';
import { fetchWithCache } from './response-cache';
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
import type { CropMaster, FieldBlock, FieldDetail } from '../types/fields';
import type { ScanResult } from '../types/scan';
import type { CultivationActivity } from '../types/activities';
import type { FarmerRecommendation, RecommendationDetail } from '../types/recommendations';
import type {
  ActiveSeasonDashboard,
  CropSeasonDetail,
  CropSeasonSummary,
  ExpenseBookGroup,
  FarmerCategory,
  MarketIntel,
  PortalNotification,
  RoiActivityType,
  RoiAnalytics,
  RoiContext,
  RoiDashboard,
  RoiDashboardV2,
  RoiExpenseType,
  RoiFilterState,
  RoiHistoryResponse,
  RoiLabourType,
  TransactionRow,
  WeatherIntel,
} from '../types/intel';

export const FARMER_TOKEN_KEY = 'morbeez_farmer_token';

export type { FarmerProfile } from '../types/farmer-portal';

function getWebStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

async function getStoredToken(): Promise<string | null> {
  return readPersistedItem(FARMER_TOKEN_KEY);
}

async function setStoredToken(token: string): Promise<void> {
  await writePersistedItem(FARMER_TOKEN_KEY, token);
}

async function clearStoredToken(): Promise<void> {
  await deletePersistedItem(FARMER_TOKEN_KEY);
}

/** True when the server rejected credentials (not a transient network failure). */
export function isFarmerAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('session invalid') ||
    lower.includes('session expired') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid token') ||
    lower.includes('not authenticated')
  );
}

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload || typeof globalThis.atob !== 'function') return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(globalThis.atob(normalized)) as { exp?: number };
    return typeof parsed.exp === 'number' ? parsed.exp : null;
  } catch {
    return null;
  }
}

export function isFarmerTokenExpired(token: string): boolean {
  const exp = decodeJwtExp(token);
  if (exp == null) return false;
  return exp * 1000 <= Date.now();
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
  const origin = getApiOrigin();
  if (!origin) {
    throw new Error(
      'API URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in apps/farmer/.env (local) or eas.json (builds).'
    );
  }
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
  const res = await fetchWithRetry(url, { ...options, headers }, 2, origin);
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

export async function sendOtp(phone: string) {
  return farmerApi<{ ok: boolean; sent: boolean; expiresInSeconds: number; devOtp?: string }>(
    '/api/v1/auth/otp/send',
    { method: 'POST', body: JSON.stringify({ phone }) }
  );
}

export async function verifyOtp(phone: string, code: string) {
  const data = await farmerApi<{ ok: boolean; token: string; farmer: FarmerProfile }>(
    '/api/v1/auth/otp/verify',
    { method: 'POST', body: JSON.stringify({ phone, code }) }
  );
  await setFarmerToken(data.token);
  return data;
}

export async function farmerSignup(body: {
  email?: string;
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

export async function changeFarmerPassword(input: {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return farmerApi<{ ok: boolean; hasPassword: boolean }>('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
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

export async function createFarmerSoilReport(body: {
  blockId: string;
  reportedAt?: string;
  macro?: Record<string, string>;
  micro?: Record<string, string>;
  remarks?: string;
  imageData?: string;
  mimeType?: string;
}): Promise<{ id: string; blockId: string }> {
  const data = await farmerApi<{ ok: boolean; report: { id: string; blockId: string } }>(
    '/api/v1/farmer/portal/soil-reports',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return data.report;
}

export async function createFarmerFieldFinding(
  blockId: string,
  body: {
    diseasePest?: string;
    observations?: string;
    diseaseTone?: 'healthy' | 'warning' | 'danger';
    actionTaken?: string;
  }
): Promise<{ id: string }> {
  const data = await farmerApi<{ ok: boolean; finding: { id: string } }>(
    `/api/v1/farmer/portal/blocks/${encodeURIComponent(blockId)}/field-findings`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  return data.finding;
}

export async function createFarmerBlockRecommendation(
  blockId: string,
  body: {
    problem?: string;
    recommendation: string;
    dosage?: string;
    applicationMethod?: string;
  }
): Promise<{ id: string }> {
  const data = await farmerApi<{ ok: boolean; recommendation: { id: string } }>(
    `/api/v1/farmer/portal/blocks/${encodeURIComponent(blockId)}/recommendations`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  return data.recommendation;
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

export async function updateFarmerPreferredLanguage(
  preferredLanguage: 'en' | 'hi' | 'ml' | 'ta' | 'kn'
): Promise<FarmerProfile> {
  const data = await farmerApi<{ ok: boolean; profile: FarmerProfile }>('/api/v1/farmer/portal/language', {
    method: 'PATCH',
    body: JSON.stringify({ preferredLanguage }),
  });
  return data.profile;
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

export type CodCheckoutResult = {
  shopifyOrderId: string;
  orderName?: string;
  orderStatusUrl?: string;
  paymentMethod: 'cod';
};

export async function createCodCheckout(body: CheckoutCreateInput): Promise<CodCheckoutResult> {
  const data = await farmerApi<{ ok: boolean } & CodCheckoutResult>(
    '/api/v1/checkout/cod/create',
    {
      method: 'POST',
      body: JSON.stringify({ channel: 'mobile', ...body }),
    }
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

export async function fetchCropMasters(): Promise<CropMaster[]> {
  const data = await farmerApi<{ ok: boolean; crops: CropMaster[] }>(
    '/api/v1/farmer/portal/masters/crops'
  );
  return data.crops ?? [];
}

export type ApplicationMethodMaster = { id: string; name: string };

export async function fetchApplicationMethods(): Promise<ApplicationMethodMaster[]> {
  const data = await farmerApi<{ ok: boolean; methods: ApplicationMethodMaster[] }>(
    '/api/v1/farmer/portal/masters/application-methods'
  );
  return data.methods ?? [];
}

export async function createFarmerApplicationMethod(name: string): Promise<ApplicationMethodMaster> {
  const data = await farmerApi<{ ok: boolean; method: ApplicationMethodMaster }>(
    '/api/v1/farmer/portal/masters/application-methods',
    { method: 'POST', body: JSON.stringify({ name }) }
  );
  return data.method;
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

export async function updateFieldBlock(
  blockId: string,
  body: {
    name?: string;
    cropType?: string;
    acreage?: number;
    plantingDate?: string;
    irrigationType?: string;
  }
): Promise<FieldBlock> {
  const data = await farmerApi<{ ok: boolean; block: FieldBlock }>(
    `/api/v1/farmer/portal/blocks/${encodeURIComponent(blockId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );
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

export type ScanHistoryItem = {
  sessionId: string;
  blockId: string | null;
  status: string;
  detectedIssue: string;
  summary: string | null;
  createdAt: string;
  dateLabel: string;
};

export async function fetchScanHistory(params?: { blockId?: string; limit?: number }): Promise<ScanHistoryItem[]> {
  const qs = new URLSearchParams();
  if (params?.blockId) qs.set('blockId', params.blockId);
  if (params?.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  const data = await farmerApi<{ ok: boolean; scans: ScanHistoryItem[] }>(
    `/api/v1/farmer/portal/scans${q ? `?${q}` : ''}`
  );
  return data.scans ?? [];
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
  activityTypeId?: string;
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

export type MarketCropItem = {
  id: string;
  cropName: string;
  icon: string | null;
  displayOrder: number;
};

export type MarketDashboard = {
  crop: string;
  favoriteCrop: string;
  crops: MarketCropItem[];
  date: string;
  priceIsToday?: boolean;
  districtLabel: string;
  selectedMarket: string | null;
  primaryMarket: string | null;
  todayPrice: number | null;
  dailyChangeInr: number | null;
  dailyTrend: 'up' | 'down' | 'flat' | null;
  weeklyTrendPct: number | null;
  yoyPct: number | null;
  lastYearSameDayPricePerKg: number | null;
  differenceInr: number | null;
  dailyChangePct: number | null;
  trend: 'up' | 'down' | 'flat' | null;
  priceDirection: 'strong' | 'weak' | 'neutral';
  rows: Array<{
    marketName: string;
    pricePerKg: number;
    lastYearPricePerKg: number | null;
    trend: 'up' | 'down' | 'flat' | null;
    yoyPct: number | null;
  }>;
};

export async function fetchMarketCrops(): Promise<MarketCropItem[]> {
  const data = await farmerApi<{ ok: boolean; crops: MarketCropItem[] }>('/api/v1/farmer/portal/market/crops');
  return data.crops ?? [];
}

const MARKET_CACHE_TTL_MS = 120_000;

export async function fetchMarketDashboard(crop?: string, market?: string): Promise<MarketDashboard> {
  const key = `market-dashboard:${crop ?? ''}:${market ?? ''}`;
  return fetchWithCache(key, MARKET_CACHE_TTL_MS, async () => {
    const qs = new URLSearchParams();
    if (crop) qs.set('crop', crop);
    if (market) qs.set('market', market);
    const q = qs.toString();
    const data = await farmerApi<{ ok: boolean; dashboard: MarketDashboard }>(
      `/api/v1/farmer/portal/market/dashboard${q ? `?${q}` : ''}`
    );
    return data.dashboard;
  });
}

export type MarketTrends = {
  crop: string;
  marketName: string;
  date: string;
  range: string;
  points: Array<{ month: number; monthLabel: string; currentYear: number | null; previousYear: number | null }>;
  seasonal: Array<{ month: string; currentYear: number | null; previousYear: number | null }>;
  overlayCurrent: Array<{ label: string; value: number }>;
  overlayPrevious: Array<{ label: string; value: number }>;
  insights: string[];
  priceDirection: 'up' | 'down' | 'flat';
};

export async function fetchMarketTrends(
  crop?: string,
  range?: string,
  market?: string
): Promise<MarketTrends> {
  const key = `market-trends:${crop ?? ''}:${range ?? ''}:${market ?? ''}`;
  return fetchWithCache(key, MARKET_CACHE_TTL_MS, async () => {
    const qs = new URLSearchParams();
    if (crop) qs.set('crop', crop);
    if (range) qs.set('range', range);
    if (market) qs.set('market', market);
    const q = qs.toString();
    const data = await farmerApi<{ ok: boolean; trends: MarketTrends }>(
      `/api/v1/farmer/portal/market/trends${q ? `?${q}` : ''}`
    );
    return data.trends;
  });
}

export type MandiComparison = {
  crop: string;
  date: string;
  preferredMarket: string | null;
  highestMarket: string | null;
  rows: Array<{
    marketName: string;
    pricePerKg: number;
    lastYearPricePerKg: number | null;
    trend: 'up' | 'down' | 'flat' | null;
    yoyPct: number | null;
    isHighest: boolean;
    isPreferred: boolean;
  }>;
};

export async function fetchMandiComparison(crop?: string, market?: string): Promise<MandiComparison> {
  const key = `mandi-comparison:${crop ?? ''}:${market ?? ''}`;
  return fetchWithCache(key, MARKET_CACHE_TTL_MS, async () => {
    const qs = new URLSearchParams();
    if (crop) qs.set('crop', crop);
    if (market) qs.set('market', market);
    const q = qs.toString();
    const data = await farmerApi<{ ok: boolean; comparison: MandiComparison }>(
      `/api/v1/farmer/portal/market/mandi-comparison${q ? `?${q}` : ''}`
    );
    return data.comparison;
  });
}

export type MultiCropComparison = {
  marketName: string;
  date: string;
  favoriteCrop: string | null;
  bestCrop: string | null;
  crops: Array<{
    crop: string;
    icon: string | null;
    marketName: string;
    pricePerKg: number | null;
    yoyPct: number | null;
    weeklyTrendPct: number | null;
    trend: 'up' | 'down' | 'flat' | null;
    signal: 'strong' | 'weak' | 'neutral';
    date: string;
  }>;
};

export async function fetchMultiCropComparison(market?: string): Promise<MultiCropComparison> {
  const key = `crop-comparison:${market ?? ''}`;
  return fetchWithCache(key, MARKET_CACHE_TTL_MS, async () => {
    const q = market ? `?market=${encodeURIComponent(market)}` : '';
    const data = await farmerApi<{ ok: boolean; comparison: MultiCropComparison }>(
      `/api/v1/farmer/portal/market/crop-comparison${q}`
    );
    return data.comparison;
  });
}

export type StoreBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
};

export async function fetchStoreBanners(placement = 'home_hero'): Promise<StoreBanner[]> {
  const data = await farmerApi<{ ok: boolean; banners: StoreBanner[] }>(
    `/api/v1/store/banners?placement=${encodeURIComponent(placement)}`
  );
  return data.banners ?? [];
}

export async function fetchStoreRecommendations(): Promise<StoreProduct[]> {
  const data = await farmerApi<{ ok: boolean; products: StoreProduct[] }>('/api/v1/store/recommendations');
  return data.products ?? [];
}

/** @deprecated Use fetchRoiSummary */
export async function fetchRoiDashboard(): Promise<RoiDashboard> {
  const data = await farmerApi<{ ok: boolean; dashboard: RoiDashboard }>(
    '/api/v1/farmer/portal/roi/dashboard'
  );
  return data.dashboard;
}

export async function fetchActiveSeasonRoi(blockId?: string): Promise<ActiveSeasonDashboard> {
  const q = blockId ? `?blockId=${encodeURIComponent(blockId)}` : '';
  const data = await farmerApi<{ ok: boolean; dashboard: ActiveSeasonDashboard }>(
    `/api/v1/farmer/portal/roi/season/active${q}`
  );
  return data.dashboard;
}

export async function fetchRoiExpenseTypes(): Promise<RoiExpenseType[]> {
  const data = await farmerApi<{ ok: boolean; types: RoiExpenseType[] }>(
    '/api/v1/farmer/portal/roi/expense-types'
  );
  return data.types ?? [];
}

export async function fetchRoiLabourTypes(): Promise<RoiLabourType[]> {
  const data = await farmerApi<{ ok: boolean; types: RoiLabourType[] }>(
    '/api/v1/farmer/portal/roi/labour-types'
  );
  return data.types ?? [];
}

export async function fetchRoiActivityTypes(crop?: string): Promise<RoiActivityType[]> {
  const q = crop ? `?crop=${encodeURIComponent(crop)}` : '';
  const data = await farmerApi<{ ok: boolean; types: Array<Record<string, unknown>> }>(
    `/api/v1/farmer/portal/roi/activity-types${q}`
  );
  return (data.types ?? []).map((t) => ({
    id: String(t.id),
    activityName: String(t.activityName ?? t.activity_name ?? 'Activity'),
    icon: t.icon ? String(t.icon) : null,
    category: t.category ? String(t.category) : undefined,
  }));
}

export async function createFarmerActivityType(body: {
  activityName: string;
  crop?: string;
  category?: string;
  icon?: string;
}): Promise<RoiActivityType> {
  const data = await farmerApi<{ ok: boolean; type: RoiActivityType }>(
    '/api/v1/farmer/portal/roi/activity-types',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return data.type;
}

function roiQuery(filter?: RoiFilterState): string {
  const params = new URLSearchParams();
  if (filter?.crop) params.set('crop', filter.crop);
  if (filter?.blockId) params.set('blockId', filter.blockId);
  const q = params.toString();
  return q ? `?${q}` : '';
}

export async function fetchRoiSummary(filter?: RoiFilterState): Promise<RoiDashboardV2> {
  const data = await farmerApi<{ ok: boolean; summary: RoiDashboardV2 }>(
    `/api/v1/farmer/portal/roi/summary${roiQuery(filter)}`
  );
  return data.summary;
}

export async function fetchRoiContext(filter?: RoiFilterState): Promise<RoiContext> {
  const data = await farmerApi<{ ok: boolean; context: RoiContext }>(
    `/api/v1/farmer/portal/roi/context${roiQuery(filter)}`
  );
  return data.context;
}

export async function fetchRoiCategories(): Promise<FarmerCategory[]> {
  const data = await farmerApi<{ ok: boolean; categories: FarmerCategory[] }>(
    '/api/v1/farmer/portal/roi/categories'
  );
  return data.categories ?? [];
}

export async function createFarmerCategory(body: {
  name: string;
  icon?: string;
  color?: string;
}): Promise<FarmerCategory> {
  const data = await farmerApi<{ ok: boolean; category: FarmerCategory }>(
    '/api/v1/farmer/portal/roi/categories',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return data.category;
}

export async function fetchRoiTransactions(opts?: {
  seasonId?: string;
  blockId?: string;
  crop?: string;
  type?: 'expense' | 'income';
  from?: string;
  to?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}): Promise<{ transactions: TransactionRow[]; pagination: { page: number; limit: number; total: number } }> {
  const params = new URLSearchParams();
  if (opts?.seasonId) params.set('seasonId', opts.seasonId);
  if (opts?.blockId) params.set('blockId', opts.blockId);
  if (opts?.crop) params.set('crop', opts.crop);
  if (opts?.type) params.set('type', opts.type);
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  if (opts?.categoryId) params.set('categoryId', opts.categoryId);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const q = params.toString();
  const data = await farmerApi<{
    ok: boolean;
    transactions: TransactionRow[];
    pagination: { page: number; limit: number; total: number };
  }>(`/api/v1/farmer/portal/roi/transactions${q ? `?${q}` : ''}`);
  return { transactions: data.transactions ?? [], pagination: data.pagination };
}

export async function fetchSeasonEntries(
  seasonId: string,
  opts?: { page?: number; limit?: number }
): Promise<{
  entries: Array<{
    id: string;
    dateLabel: string;
    amountInr: number;
    type: string;
    label: string;
    note: string | null;
  }>;
  pagination: { page: number; limit: number; total: number };
}> {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const q = params.toString();
  const data = await farmerApi<{
    ok: boolean;
    entries: Array<{
      id: string;
      dateLabel: string;
      amountInr: number;
      type: string;
      label: string;
      note: string | null;
    }>;
    pagination: { page: number; limit: number; total: number };
  }>(`/api/v1/farmer/portal/roi/season/${encodeURIComponent(seasonId)}/entries${q ? `?${q}` : ''}`);
  return { entries: data.entries ?? [], pagination: data.pagination };
}

export async function fetchExpenseBook(filter?: RoiFilterState): Promise<ExpenseBookGroup[]> {
  const data = await farmerApi<{ ok: boolean; groups: ExpenseBookGroup[] }>(
    `/api/v1/farmer/portal/roi/expense-book${roiQuery(filter)}`
  );
  return data.groups ?? [];
}

export async function fetchRoiAnalytics(filter?: RoiFilterState): Promise<RoiAnalytics> {
  const data = await farmerApi<{ ok: boolean; analytics: RoiAnalytics }>(
    `/api/v1/farmer/portal/roi/analytics${roiQuery(filter)}`
  );
  return data.analytics;
}

export async function recordHarvestSale(body: {
  yieldKg: number;
  sellingPricePerKg: number;
  seasonId?: string;
  blockId?: string;
  harvestDate?: string;
  buyer?: string;
}) {
  const data = await farmerApi<{
    ok: boolean;
    seasonId: string;
    harvestCount: number;
    totalIncomeInr: number;
    netProfitInr: number;
    roiPercent: number;
  }>('/api/v1/farmer/portal/roi/harvest-sale', { method: 'POST', body: JSON.stringify(body) });
  return data;
}

export async function recordIncome(body: {
  incomeSubtype: 'advance' | 'subsidy' | 'other';
  amount: number;
  seasonId?: string;
  blockId?: string;
  entryDate?: string;
  note?: string;
}) {
  return farmerApi<{ ok: boolean; id: string; seasonId: string }>(
    '/api/v1/farmer/portal/roi/income',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function finishCropCycle(
  seasonId: string,
  body?: { password?: string; confirmText?: string }
) {
  return farmerApi<{
    ok: boolean;
    seasonId: string;
    netProfitInr: number;
    totalExpenseInr: number;
    totalIncomeInr: number;
    roiPercent: number;
  }>(`/api/v1/farmer/portal/roi/season/${encodeURIComponent(seasonId)}/finish`, {
    method: 'POST',
    body: JSON.stringify(body ?? { confirmText: 'COMPLETE' }),
  });
}

export async function startCropCycle(body: {
  blockId: string;
  crop: string;
  acreage?: number;
  plantingDate?: string;
}) {
  return farmerApi<{ ok: boolean; season: { id: string } }>(
    '/api/v1/farmer/portal/roi/season/start',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function updateRoiTransaction(
  entryId: string,
  body: { amount?: number; note?: string; entryDate?: string }
): Promise<{ id: string }> {
  const data = await farmerApi<{ ok: boolean; id: string }>(
    `/api/v1/farmer/portal/roi/transactions/${encodeURIComponent(entryId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );
  return { id: data.id };
}

export async function deleteRoiTransaction(entryId: string): Promise<void> {
  await farmerApi<{ ok: boolean }>(
    `/api/v1/farmer/portal/roi/transactions/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' }
  );
}

export async function fetchRoiHistoryV2(): Promise<RoiHistoryResponse> {
  const data = await farmerApi<{ ok: boolean; active: RoiHistoryResponse['active']; completed: CropSeasonSummary[] }>(
    '/api/v1/farmer/portal/roi/history?v=2'
  );
  return { active: data.active ?? [], completed: data.completed ?? [] };
}

export async function createQuickExpense(body: {
  expenseTypeId?: string;
  categoryId?: string;
  amount: number;
  seasonId?: string;
  blockId?: string;
  entryDate?: string;
  note?: string;
}): Promise<{ id: string; seasonId: string }> {
  const data = await farmerApi<{ ok: boolean; id: string; seasonId: string }>(
    '/api/v1/farmer/portal/roi/expenses',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return { id: data.id, seasonId: data.seasonId };
}

export async function createLabourExpense(body: {
  labourTypeId: string;
  amount: number;
  workers?: number;
  seasonId?: string;
  note?: string;
  entryDate?: string;
}): Promise<{ id: string; seasonId: string }> {
  const data = await farmerApi<{ ok: boolean; id: string; seasonId: string }>(
    '/api/v1/farmer/portal/roi/labour',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return { id: data.id, seasonId: data.seasonId };
}

/** @deprecated Use recordHarvestSale */
export async function submitHarvest(body: {
  yieldKg: number;
  sellingPricePerKg: number;
  seasonId?: string;
  blockId?: string;
  harvestDate?: string;
  buyer?: string;
}) {
  const data = await recordHarvestSale(body);
  return {
    seasonId: data.seasonId,
    totalIncomeInr: data.totalIncomeInr,
    netProfitInr: data.netProfitInr,
    roiPercent: data.roiPercent,
  };
}

export async function fetchCropHistory(): Promise<CropSeasonSummary[]> {
  const data = await farmerApi<{ ok: boolean; seasons: CropSeasonSummary[] }>(
    '/api/v1/farmer/portal/roi/history'
  );
  return data.seasons ?? [];
}

export async function fetchSeasonDetail(seasonId: string): Promise<CropSeasonDetail> {
  const data = await farmerApi<{ ok: boolean; detail: CropSeasonDetail }>(
    `/api/v1/farmer/portal/roi/history/${encodeURIComponent(seasonId)}`
  );
  return data.detail;
}

export async function recordShopPurchaseExpense(body: {
  orderId: string;
  amount: number;
  productSummary: string;
}): Promise<{ id: string }> {
  const data = await farmerApi<{ ok: boolean; id: string }>(
    '/api/v1/farmer/portal/roi/purchase-order',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return { id: data.id };
}
