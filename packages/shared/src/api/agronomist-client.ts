import { STAFF_API_V1 } from './config';
import { fetchWithCache } from './response-cache';
import { staffApi } from './staff-client';
import type {
  AgronomistBlockRow,
  AgronomistCallbackRow,
  AgronomistDashboard,
  AgronomistDocumentRow,
  AgronomistRecommendationRow,
  AgronomistEscalationRow,
  AgronomistFarmerSearchRow,
  AgronomistRouteSummary,
  AgronomistTaskItem,
  AgronomistVisitSession,
  AgronomistWorkspaceSummary,
  FieldVisitQuestion,
  ReviewQueueItem,
} from '../types/agronomist';
import type { BlockFieldFinding, BlockRecommendationItem } from '../types/fields';
import type { CultivationActivity } from '../types/activities';
import type { PortalSoilReport } from '../types/farmer-portal';

const FIELD = `${STAFF_API_V1}/os/field`;
const AGRO = `${STAFF_API_V1}/os/agronomist`;
const TEL = `${STAFF_API_V1}/os/telecaller`;
const DASHBOARD_TTL_MS = 30_000;

export const agronomistClient = {
  async getDashboard(opts?: { force?: boolean }): Promise<AgronomistDashboard> {
    return fetchWithCache(
      'agronomist-dashboard',
      DASHBOARD_TTL_MS,
      async () => {
        const r = await staffApi<{ ok: boolean; dashboard: AgronomistDashboard }>(`${AGRO}/mobile/dashboard`);
        return r.dashboard;
      },
      opts
    );
  },

  async searchFarmers(q: string, limit = 20): Promise<AgronomistFarmerSearchRow[]> {
    const r = await staffApi<{ ok: boolean; farmers: AgronomistFarmerSearchRow[] }>(
      `${FIELD}/farmers/search?q=${encodeURIComponent(q)}&limit=${limit}`
    );
    return r.farmers ?? [];
  },

  async listFarmers(opts?: {
    q?: string;
    filter?: string;
    lat?: number;
    lng?: number;
    limit?: number;
  }): Promise<AgronomistFarmerSearchRow[]> {
    const params = new URLSearchParams();
    if (opts?.q) params.set('q', opts.q);
    if (opts?.filter) params.set('filter', opts.filter);
    if (opts?.lat != null) params.set('lat', String(opts.lat));
    if (opts?.lng != null) params.set('lng', String(opts.lng));
    if (opts?.limit) params.set('limit', String(opts.limit));
    const r = await staffApi<{ ok: boolean; farmers: AgronomistFarmerSearchRow[] }>(
      `${AGRO}/mobile/farmers?${params}`
    );
    return r.farmers ?? [];
  },

  async getFarmerBlocks(farmerId: string): Promise<AgronomistBlockRow[]> {
    const r = await staffApi<{ ok: boolean; blocks: AgronomistBlockRow[] }>(`${FIELD}/farmers/${farmerId}/blocks`);
    return r.blocks ?? [];
  },

  async getWorkspaceSummary(farmerId: string): Promise<AgronomistWorkspaceSummary> {
    const r = await staffApi<{ ok: boolean; summary: AgronomistWorkspaceSummary }>(
      `${AGRO}/farmers/${farmerId}/workspace-summary`
    );
    return r.summary;
  },

  async getFarmerDocuments(farmerId: string): Promise<AgronomistDocumentRow[]> {
    const r = await staffApi<{ ok: boolean; documents: AgronomistDocumentRow[] }>(
      `${AGRO}/farmers/${farmerId}/documents`
    );
    return r.documents ?? [];
  },

  async listFarmerRecommendations(farmerId: string, limit = 20): Promise<AgronomistRecommendationRow[]> {
    const r = await staffApi<{ ok: boolean; recommendations: AgronomistRecommendationRow[] }>(
      `${AGRO}/farmers/${farmerId}/recommendations?limit=${limit}`
    );
    return r.recommendations ?? [];
  },

  async createFarmerRecommendation(
    farmerId: string,
    body: {
      blockId?: string;
      leadId?: string;
      fieldFindingId?: string;
      issueDetected?: string;
      recommendationText: string;
      dosage?: string;
      weatherWarning?: string;
      language?: string;
    }
  ) {
    return staffApi<{ ok: boolean; recommendation: AgronomistRecommendationRow }>(
      `${AGRO}/farmers/${farmerId}/recommendations`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  },

  async getBlockDetail(farmerId: string, blockId: string) {
    const r = await staffApi<{
      ok: boolean;
      block: AgronomistBlockRow;
      activities: CultivationActivity[];
      soilReports: PortalSoilReport[];
      fieldFindings: BlockFieldFinding[];
      blockRecommendations: BlockRecommendationItem[];
    }>(`${AGRO}/farmers/${farmerId}/blocks/${encodeURIComponent(blockId)}/detail`);
    return r;
  },

  async getFarmerIntelligence(farmerId: string) {
    return staffApi<{ ok: boolean; profile: Record<string, unknown> }>(`${AGRO}/farmers/${farmerId}/intelligence`);
  },

  async listTasks(filter?: string): Promise<AgronomistTaskItem[]> {
    const q = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    const r = await staffApi<{ ok: boolean; tasks: AgronomistTaskItem[] }>(`${AGRO}/mobile/tasks${q}`);
    return r.tasks ?? [];
  },

  async listCallbacks(): Promise<AgronomistCallbackRow[]> {
    const r = await staffApi<{ ok: boolean; callbacks: AgronomistCallbackRow[] }>(`${AGRO}/callbacks`);
    return r.callbacks ?? [];
  },

  async updateCallback(id: string, status: string) {
    return staffApi(`${AGRO}/callbacks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  async createCallback(body: { farmerId: string; reason: string; dueInDays?: number }) {
    return staffApi(`${AGRO}/callbacks`, { method: 'POST', body: JSON.stringify(body) });
  },

  async listEscalations(opts?: { status?: string; farmerId?: string }): Promise<AgronomistEscalationRow[]> {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.farmerId) params.set('farmerId', opts.farmerId);
    const r = await staffApi<{ ok: boolean; escalations: AgronomistEscalationRow[] }>(
      `${AGRO}/mobile/escalations?${params}`
    );
    return r.escalations ?? [];
  },

  async updateEscalationStatus(id: string, status: string, notes?: string) {
    return staffApi(`${AGRO}/escalations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  },

  async getProfileStats() {
    const r = await staffApi<{ ok: boolean; profile: Record<string, unknown> }>(`${AGRO}/mobile/profile`);
    return r.profile;
  },

  async getReviewQueue(limit = 40): Promise<ReviewQueueItem[]> {
    const r = await staffApi<{ ok: boolean; items: ReviewQueueItem[] }>(`${AGRO}/queue?limit=${limit}`);
    return r.items ?? [];
  },

  async getFinding(id: string) {
    return staffApi<{ ok: boolean } & Record<string, unknown>>(`${AGRO}/findings/${id}`);
  },

  async aiSuggestFinding(id: string) {
    return staffApi(`${AGRO}/findings/${id}/ai-suggest`, { method: 'POST', body: '{}' });
  },

  async saveDraft(body: Record<string, unknown>) {
    return staffApi(`${AGRO}/drafts`, { method: 'POST', body: JSON.stringify(body) });
  },

  async submitRecommendation(id: string) {
    return staffApi(`${AGRO}/recommendations/${id}/submit`, { method: 'POST', body: '{}' });
  },

  async listAiCases(status = 'open') {
    return staffApi<{ ok: boolean; items: unknown[]; total: number }>(`${AGRO}/cases?status=${status}&limit=24`);
  },

  async getAiCase(id: string) {
    return staffApi<{ ok: boolean } & Record<string, unknown>>(`${AGRO}/cases/${id}`);
  },

  async reviewAiCase(id: string, body: Record<string, unknown>) {
    return staffApi(`${AGRO}/cases/${id}/review`, { method: 'POST', body: JSON.stringify(body) });
  },

  async getQuestionnaire(cropType: string): Promise<FieldVisitQuestion[]> {
    const r = await staffApi<{ ok: boolean; questions: FieldVisitQuestion[] }>(
      `${FIELD}/questionnaire/${encodeURIComponent(cropType)}`
    );
    return r.questions ?? [];
  },

  async startVisitSession(body: {
    farmerId: string;
    blockId?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<AgronomistVisitSession> {
    const r = await staffApi<{ ok: boolean; session: Record<string, unknown> }>(`${FIELD}/visits/sessions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const s = r.session;
    return {
      id: String(s.id),
      farmerId: String(s.farmer_id),
      blockId: s.block_id ? String(s.block_id) : null,
      status: String(s.status),
      checkInAt: String(s.check_in_at),
      checkOutAt: s.check_out_at ? String(s.check_out_at) : null,
      durationMinutes: s.duration_minutes != null ? Number(s.duration_minutes) : null,
    };
  },

  async checkOutVisitSession(
    sessionId: string,
    body: { latitude?: number; longitude?: number; fieldFindingId?: string }
  ) {
    return staffApi(`${FIELD}/visits/sessions/${sessionId}/check-out`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async submitVisit(body: Record<string, unknown>) {
    return staffApi(`${FIELD}/visits`, { method: 'POST', body: JSON.stringify(body) });
  },

  async saveBlockLocation(blockId: string, body: { farmerId: string; latitude: number; longitude: number }) {
    return staffApi(`${FIELD}/blocks/${blockId}/location`, { method: 'POST', body: JSON.stringify(body) });
  },

  async listRecentVisits(farmerId?: string) {
    const q = farmerId ? `?farmerId=${encodeURIComponent(farmerId)}` : '';
    const r = await staffApi<{ ok: boolean; visits: unknown[] }>(`${FIELD}/visits/recent${q}`);
    return r.visits ?? [];
  },

  async listRoutes(date?: string): Promise<AgronomistRouteSummary[]> {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    const r = await staffApi<{ ok: boolean; routes: AgronomistRouteSummary[] }>(`${AGRO}/routes${q}`);
    return r.routes ?? [];
  },

  async createRoute(routeName: string): Promise<AgronomistRouteSummary> {
    const r = await staffApi<{ ok: boolean; route: AgronomistRouteSummary }>(`${AGRO}/routes`, {
      method: 'POST',
      body: JSON.stringify({ routeName }),
    });
    return r.route;
  },

  async getRoute(id: string): Promise<AgronomistRouteSummary> {
    const r = await staffApi<{ ok: boolean; route: AgronomistRouteSummary }>(`${AGRO}/routes/${id}`);
    return r.route;
  },

  async addRouteStop(routeId: string, farmerId: string, blockId?: string) {
    return staffApi(`${AGRO}/routes/${routeId}/stops`, {
      method: 'POST',
      body: JSON.stringify({ farmerId, blockId }),
    });
  },

  async optimizeRoute(routeId: string, lat?: number, lng?: number): Promise<AgronomistRouteSummary> {
    const r = await staffApi<{ ok: boolean; route: AgronomistRouteSummary }>(`${AGRO}/routes/${routeId}/optimize`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    });
    return r.route;
  },

  async completeTask(taskId: string) {
    return staffApi(`${TEL}/tasks/${taskId}/complete`, { method: 'PATCH', body: '{}' });
  },

  async patchTask(taskId: string, body: Record<string, unknown>) {
    return staffApi(`${TEL}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(body) });
  },

  async getLeadDetail(leadId: string) {
    return staffApi<{ ok: boolean } & Record<string, unknown>>(`${TEL}/leads/${leadId}`);
  },

  async getLeadRecommendations(leadId: string) {
    return staffApi<{ ok: boolean; recommendations: unknown[] }>(`${TEL}/leads/${leadId}/recommendations`);
  },

  async getLeadInteractions(leadId: string) {
    return staffApi<{ ok: boolean; interactions: unknown[] }>(`${TEL}/leads/${leadId}/interactions`);
  },

  async getLeadOrders(leadId: string) {
    return staffApi<{ ok: boolean; orders: unknown[] }>(`${TEL}/leads/${leadId}/orders`);
  },

  async getBlockWorkspace(leadId: string, blockId: string) {
    return staffApi<{ ok: boolean } & Record<string, unknown>>(`${TEL}/leads/${leadId}/blocks/${blockId}/workspace`);
  },
};
