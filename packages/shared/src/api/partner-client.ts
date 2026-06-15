import { resolveApiUrl } from './config';
import type { PartnerDashboardStats, PartnerProfile } from '../types/partner';

const PARTNER_API = '/morbeez-partner/api/v1';
const TOKEN_KEY = 'morbeez_partner_token';

async function readToken(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    return (await SecureStore.getItemAsync(TOKEN_KEY)) as string | null;
  } catch {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  }
}

export async function setPartnerToken(token: string | null): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    }
  }
}

async function partnerApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await readToken();
  const res = await fetch(resolveApiUrl(`${PARTNER_API}${path}`), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; ok?: boolean };
  if (!res.ok) throw new Error(body.message ?? `Request failed (${res.status})`);
  return body;
}

export async function sendPartnerOtp(phone: string) {
  return partnerApi<{ ok: boolean; sent: boolean; devOtp?: string }>('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyPartnerOtp(phone: string, code: string) {
  const r = await partnerApi<{ ok: boolean; token: string; partner: PartnerProfile }>(
    '/auth/otp/verify',
    { method: 'POST', body: JSON.stringify({ phone, code }) }
  );
  await setPartnerToken(r.token);
  return r;
}

export async function partnerLogin(phone: string, password: string) {
  const r = await partnerApi<{ ok: boolean; token: string; partner: PartnerProfile }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ phone, password }) }
  );
  await setPartnerToken(r.token);
  return r;
}

export async function partnerLogout() {
  await setPartnerToken(null);
}

export const partnerClient = {
  async me(): Promise<PartnerProfile> {
    const r = await partnerApi<{ ok: boolean; partner: PartnerProfile }>('/me');
    return r.partner;
  },

  async dashboard(): Promise<PartnerDashboardStats> {
    const r = await partnerApi<{ ok: boolean; stats: PartnerDashboardStats }>('/dashboard');
    return r.stats;
  },

  async listFarmers() {
    const r = await partnerApi<{ ok: boolean; farmers: Array<Record<string, unknown>> }>('/farmers');
    return r.farmers;
  },

  async listTasks() {
    const r = await partnerApi<{ ok: boolean; tasks: Array<Record<string, unknown>> }>('/tasks');
    return r.tasks;
  },

  async acceptTask(taskId: string) {
    return partnerApi(`/tasks/${taskId}/accept`, { method: 'POST', body: '{}' });
  },

  async completeTask(taskId: string) {
    return partnerApi(`/tasks/${taskId}/complete`, { method: 'POST', body: '{}' });
  },

  async getReferral() {
    return partnerApi<{
      ok: boolean;
      partnerCode: string;
      referralUrl: string;
      qrToken: string | null;
    }>('/referral');
  },

  async listLeadOffers() {
    const r = await partnerApi<{ ok: boolean; offers: Array<Record<string, unknown>> }>(
      '/lead-offers'
    );
    return r.offers;
  },

  async respondLeadOffer(id: string, action: 'accepted' | 'declined') {
    return partnerApi(`/lead-offers/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  async addTimelineNote(farmerId: string, body: string) {
    return partnerApi(`/farmers/${farmerId}/timeline`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  async startVisitSession(input: {
    farmerId: string;
    blockId?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return partnerApi('/visits/sessions/start', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async checkOutVisitSession(
    sessionId: string,
    input: { latitude?: number; longitude?: number; fieldFindingId?: string }
  ) {
    return partnerApi(`/visits/sessions/${sessionId}/check-out`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async submitVisit(payload: Record<string, unknown>) {
    return partnerApi<{ ok: boolean; findingId?: string }>('/visits/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getIssueMaster(cropType?: string) {
    const q = cropType ? `?cropType=${encodeURIComponent(cropType)}` : '';
    const r = await partnerApi<{ ok: boolean; items: Record<string, unknown>[] }>(
      `/issue-master${q}`
    );
    return r.items ?? [];
  },

  async getFarmerWorkspace(farmerId: string) {
    const r = await partnerApi<{ ok: boolean; workspace: Record<string, unknown> }>(
      `/farmers/${farmerId}`
    );
    return r.workspace;
  },

  async getTimeline(farmerId: string) {
    const r = await partnerApi<{ ok: boolean; timeline: Record<string, unknown>[] }>(
      `/farmers/${farmerId}/timeline`
    );
    return r.timeline ?? [];
  },

  async getTeamTimeline(farmerId: string) {
    const r = await partnerApi<{ ok: boolean; timeline: Record<string, unknown>[] }>(
      `/farmers/${farmerId}/team-timeline`
    );
    return r.timeline ?? [];
  },

  async listVisits() {
    const r = await partnerApi<{ ok: boolean; visits: Record<string, unknown>[] }>('/visits');
    return r.visits ?? [];
  },

  async listNotifications() {
    const r = await partnerApi<{ ok: boolean; notifications: Record<string, unknown>[] }>(
      '/notifications'
    );
    return r.notifications ?? [];
  },

  async rejectTask(taskId: string, reason: string) {
    return partnerApi(`/tasks/${taskId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async rescheduleTask(taskId: string, dueAt: string) {
    return partnerApi(`/tasks/${taskId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ dueAt }),
    });
  },

  async createSalesOpportunity(
    farmerId: string,
    input: {
      product: string;
      expectedQuantity?: string;
      urgency?: string;
      interestLevel?: string;
      notes?: string;
    }
  ) {
    const r = await partnerApi<{ ok: boolean; opportunity: Record<string, unknown> }>(
      `/farmers/${farmerId}/sales-opportunities`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    return r.opportunity;
  },

  async listSalesOpportunities(farmerId: string) {
    const r = await partnerApi<{ ok: boolean; opportunities: Record<string, unknown>[] }>(
      `/farmers/${farmerId}/sales-opportunities`
    );
    return r.opportunities ?? [];
  },

  async getEarningsSummary(params?: { from?: string; to?: string; month?: string }) {
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.month) search.set('month', params.month);
    const q = search.toString() ? `?${search.toString()}` : '';
    const r = await partnerApi<{ ok: boolean; summary: Record<string, unknown> }>(
      `/earnings/summary${q}`
    );
    return r.summary;
  },

  async getEarningsLedger(params?: { month?: string; from?: string; to?: string }) {
    const search = new URLSearchParams();
    if (params?.month) search.set('month', params.month);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const q = search.toString() ? `?${search.toString()}` : '';
    const r = await partnerApi<{ ok: boolean; ledger: Record<string, unknown>[] }>(
      `/earnings/ledger${q}`
    );
    return r.ledger ?? [];
  },
};
