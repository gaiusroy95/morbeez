import { resolveApiUrl, getApiOrigin } from './config';
import { dedupeBy } from '../list-utils';
import { fetchWithRetry } from '../network/fetch';
import type {
  PartnerDashboardStats,
  PartnerProfile,
  AgentRouteSummary,
  PartnerFarmerListRow,
  PartnerFarmerWorkspace,
  PartnerFarmerTaskRow,
  PartnerFarmerOrderRow,
  PartnerEscalationRow,
  PartnerVisitSessionRow,
  TeamTimelineEntry,
  FarmerTimelineEntry,
} from '../types/partner';
import type { VisitAiQuestion } from '../types/field-findings';

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
  const origin = getApiOrigin();
  const res = await fetchWithRetry(
    resolveApiUrl(`${PARTNER_API}${path}`),
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    },
    2,
    origin
  );
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

  async listFarmers(): Promise<PartnerFarmerListRow[]> {
    const r = await partnerApi<{ ok: boolean; farmers: PartnerFarmerListRow[] }>('/farmers');
    return dedupeBy(r.farmers ?? [], (f) => f.id);
  },

  async listTasks() {
    const r = await partnerApi<{ ok: boolean; tasks: Array<Record<string, unknown>> }>('/tasks');
    return dedupeBy(r.tasks ?? [], (t) => String(t.id ?? ''));
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
    const r = await partnerApi<{ ok: boolean; session: Record<string, unknown> }>(
      '/visits/sessions/start',
      { method: 'POST', body: JSON.stringify(input) }
    );
    return r.session;
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
    return partnerApi<{ ok: boolean; findingId?: string; recommendationIds?: string[] }>(
      '/visits/submit',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  async getIssueMaster(cropType?: string) {
    const q = cropType ? `?cropType=${encodeURIComponent(cropType)}` : '';
    const r = await partnerApi<{ ok: boolean; items: Record<string, unknown>[] }>(
      `/issue-master${q}`
    );
    return r.items ?? [];
  },

  async createIssueMaster(input: {
    category: string;
    issueName: string;
    cropType?: string;
  }) {
    const r = await partnerApi<{ ok: boolean; item: Record<string, unknown> }>('/issue-master', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return r.item;
  },

  async getFarmerWorkspace(farmerId: string): Promise<PartnerFarmerWorkspace> {
    const r = await partnerApi<{ ok: boolean; workspace: PartnerFarmerWorkspace }>(
      `/farmers/${farmerId}`
    );
    return r.workspace;
  },

  async getFarmerTasks(farmerId: string): Promise<PartnerFarmerTaskRow[]> {
    const r = await partnerApi<{ ok: boolean; tasks: PartnerFarmerTaskRow[] }>(
      `/farmers/${farmerId}/tasks`
    );
    return dedupeBy(r.tasks ?? [], (t) => t.id);
  },

  async getFarmerOrders(farmerId: string): Promise<PartnerFarmerOrderRow[]> {
    const r = await partnerApi<{ ok: boolean; orders: PartnerFarmerOrderRow[] }>(
      `/farmers/${farmerId}/orders`
    );
    return r.orders ?? [];
  },

  async getFarmerEscalations(farmerId: string): Promise<PartnerEscalationRow[]> {
    const r = await partnerApi<{ ok: boolean; escalations: PartnerEscalationRow[] }>(
      `/farmers/${farmerId}/escalations`
    );
    return r.escalations ?? [];
  },

  async createEscalation(
    farmerId: string,
    body: { category: string; notes: string }
  ) {
    return partnerApi(`/farmers/${farmerId}/escalations`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getInteractions(farmerId: string): Promise<TeamTimelineEntry[]> {
    const r = await partnerApi<{ ok: boolean; interactions: TeamTimelineEntry[] }>(
      `/farmers/${farmerId}/interactions`
    );
    return r.interactions ?? [];
  },

  async getFarmerRecommendations(farmerId: string) {
    const r = await partnerApi<{ ok: boolean; recommendations: Record<string, unknown>[] }>(
      `/farmers/${farmerId}/recommendations`
    );
    return r.recommendations ?? [];
  },

  async getVisitSessions(farmerId: string): Promise<PartnerVisitSessionRow[]> {
    const r = await partnerApi<{ ok: boolean; sessions: PartnerVisitSessionRow[] }>(
      `/farmers/${farmerId}/visit-sessions`
    );
    return r.sessions ?? [];
  },

  async scheduleCallback(farmerId: string, notes: string) {
    return partnerApi(`/farmers/${farmerId}/schedule-callback`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async createSupportRequest(
    farmerId: string,
    body: { requestType: string; notes: string }
  ) {
    return partnerApi(`/farmers/${farmerId}/support-request`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async addTeamComment(farmerId: string, body: string) {
    return partnerApi<{ ok: boolean; entry: FarmerTimelineEntry }>(
      `/farmers/${farmerId}/team-timeline`,
      { method: 'POST', body: JSON.stringify({ body }) }
    );
  },

  async getBlockDetail(farmerId: string, blockId: string) {
    return partnerApi<Record<string, unknown>>(
      `/farmers/${farmerId}/blocks/${blockId}/detail`
    );
  },

  async getBlockTimeline(farmerId: string, blockId: string) {
    const r = await partnerApi<{ ok: boolean; timeline: unknown }>(
      `/farmers/${farmerId}/blocks/${blockId}/timeline`
    );
    return r.timeline;
  },

  async getMeasurementTemplates(cropType: string) {
    const r = await partnerApi<{ ok: boolean; templates: Record<string, unknown>[] }>(
      `/measurement-templates/${encodeURIComponent(cropType)}`
    );
    return r.templates ?? [];
  },

  async getVisitContext(body: Record<string, unknown>) {
    const r = await partnerApi<{ ok: boolean; context: Record<string, unknown> }>(
      '/visits/context',
      { method: 'POST', body: JSON.stringify(body) }
    );
    return r.context;
  },

  async analyzeVisitIssue(body: Record<string, unknown>) {
    return partnerApi<Record<string, unknown>>('/visits/analyze', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async analyzeVisit(body: Record<string, unknown>) {
    const r = await partnerApi<{
      ok: boolean;
      issues: Array<Record<string, unknown>>;
      triage?: Record<string, unknown>;
      insufficientEvidence?: boolean;
    }>('/visits/analyze-visit', { method: 'POST', body: JSON.stringify(body) });
    return {
      issues: r.issues ?? [],
      triage: r.triage,
      insufficientEvidence: r.insufficientEvidence,
    };
  },

  async skipVisitAiFollowUp(aiCaseId: string) {
    return partnerApi<{ ok: boolean; skipped: boolean }>(
      `/visits/ai-case/${encodeURIComponent(aiCaseId)}/skip-qa`,
      { method: 'POST' }
    );
  },

  async getVisitAiQuestions(aiCaseId: string): Promise<VisitAiQuestion[]> {
    const r = await partnerApi<{ ok: boolean; questions: VisitAiQuestion[] }>(
      `/visits/ai-case/${encodeURIComponent(aiCaseId)}/questions`
    );
    return r.questions ?? [];
  },

  async saveVisitAiAnswers(aiCaseId: string, answers: Array<{ questionId: string; answer: string }>) {
    return partnerApi(`/visits/ai-case/${encodeURIComponent(aiCaseId)}/questions`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  async syncVisitAiQuestions(
    aiCaseId: string,
    questions: Array<{
      id?: string;
      questionText: string;
      answer?: string;
      answerType?: import('../types/field-findings.js').VisitAiAnswerType;
    }>
  ): Promise<VisitAiQuestion[]> {
    const r = await partnerApi<{ ok: boolean; questions: VisitAiQuestion[] }>(
      `/visits/ai-case/${encodeURIComponent(aiCaseId)}/questions`,
      { method: 'PUT', body: JSON.stringify({ questions }) }
    );
    return r.questions ?? [];
  },

  async regenerateVisitAiQuestions(aiCaseId: string): Promise<VisitAiQuestion[]> {
    const r = await partnerApi<{ ok: boolean; questions: VisitAiQuestion[] }>(
      `/visits/ai-case/${encodeURIComponent(aiCaseId)}/questions/regenerate`,
      { method: 'POST' }
    );
    return r.questions ?? [];
  },

  async reanalyzeVisitAiCase(aiCaseId: string) {
    return partnerApi<{
      ok: boolean;
      finalDiagnosis: string;
      confidenceAction: string;
      hypotheses: Array<{ label: string; rationale?: string }>;
    }>(`/visits/ai-case/${encodeURIComponent(aiCaseId)}/reanalyze`, { method: 'POST' });
  },

  async recommendVisitAiCase(aiCaseId: string, finalDiagnosis?: string) {
    return partnerApi<{
      ok: boolean;
      recommendationId: string;
      text: string;
      dosage: string | null;
      priority: string;
      reviewAfterDays: number;
      reviewDate: string;
      expectedImprovementDays: string;
    }>(`/visits/ai-case/${encodeURIComponent(aiCaseId)}/recommend`, {
      method: 'POST',
      body: JSON.stringify({ finalDiagnosis }),
    });
  },

  async validateVisitPhoto(dataBase64: string, mimeType?: string) {
    return partnerApi<import('../visit-wizard/index.js').VisitPhotoValidationResult & { ok: boolean }>(
      '/visits/photos/validate',
      { method: 'POST', body: JSON.stringify({ dataBase64, mimeType }) }
    );
  },

  async getVisitEnvironment(farmerId: string, blockId: string) {
    const params = new URLSearchParams({ farmerId, blockId });
    return partnerApi<import('../visit-wizard/index.js').VisitEnvironmentPayload & { ok: boolean }>(
      `/visits/environment?${params}`
    );
  },

  async getVisitDetail(findingId: string) {
    return partnerApi<Record<string, unknown>>(`/visits/${findingId}`);
  },

  async saveBlockLocation(blockId: string, body: { farmerId: string; latitude: number; longitude: number }) {
    return partnerApi(`/blocks/${blockId}/location`, { method: 'POST', body: JSON.stringify(body) });
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
    return dedupeBy(r.notifications ?? [], (n) => String(n.id ?? ''));
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

  async listRoutes(date?: string): Promise<AgentRouteSummary[]> {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    const r = await partnerApi<{ ok: boolean; routes: AgentRouteSummary[] }>(`/routes${q}`);
    return r.routes ?? [];
  },

  async createRoute(routeName: string): Promise<AgentRouteSummary> {
    const r = await partnerApi<{ ok: boolean; route: AgentRouteSummary }>('/routes', {
      method: 'POST',
      body: JSON.stringify({ routeName }),
    });
    return r.route;
  },

  async getRoute(id: string): Promise<AgentRouteSummary> {
    const r = await partnerApi<{ ok: boolean; route: AgentRouteSummary }>(`/routes/${id}`);
    return r.route;
  },

  async addRouteStop(routeId: string, farmerId: string, blockId?: string) {
    return partnerApi(`/routes/${routeId}/stops`, {
      method: 'POST',
      body: JSON.stringify({ farmerId, blockId }),
    });
  },

  async optimizeRoute(routeId: string, lat?: number, lng?: number): Promise<AgentRouteSummary> {
    const r = await partnerApi<{ ok: boolean; route: AgentRouteSummary }>(`/routes/${routeId}/optimize`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    });
    return r.route;
  },
};
