import { STAFF_API_V1 } from './config';
import { dedupeBy } from '../list-utils';
import { fetchWithCache } from './response-cache';
import { staffApi } from './staff-client';
import type {
  AgronomistBlockRow,
  AgronomistCallbackRow,
  AgronomistDashboard,
  AgronomistDocumentRow,
  AgronomistRecommendationRow,
  RecommendationVisitContext,
  AgronomistEscalationRow,
  AgronomistFarmerSearchRow,
  AgronomistRouteSummary,
  AgronomistTaskItem,
  AgronomistVisitSession,
  AgronomistWorkspaceSummary,
  FieldVisitQuestion,
  FarmerOrderRow,
  FarmerFieldFindingRow,
  FarmerVisitRow,
  FarmerWorkspaceDashboard,
  ReviewQueueItem,
} from '../types/agronomist';
import type { BlockFieldFinding, BlockRecommendationItem } from '../types/fields';
import type {
  FollowUpBundle,
  IssueCategory,
  IssueMasterRow,
  MeasurementTemplate,
  StructuredFieldVisitPayload,
  FarmerNoteRow,
  VisitAiContextPack,
  VisitAnalyzeResponse,
  VisitAiQuestion,
  VisitAiCustomRecommendation,
  VisitAiEvidenceRequest,
  VisitAiRejectReason,
} from '../types/field-findings';
import type { FarmerCallLogSummary, FarmerInteractionRow } from '../types/interactions';
import type { CultivationActivity } from '../types/activities';
import type { PortalSoilReport } from '../types/farmer-portal';
import type {
  VisitAssistantProposalResponse,
  VisitAssistantRecommendationValidationRequest,
  VisitAssistantRecommendationValidationResult,
  VisitAssistantSnapshot,
} from '../visit-assistant/v1';
import type { VisitCopilotChatResponse, VisitCopilotWorkflowState } from '../visit-copilot/v1';

const FIELD = `${STAFF_API_V1}/os/field`;
const AGRO = `${STAFF_API_V1}/os/agronomist`;
const TEL = `${STAFF_API_V1}/os/telecaller`;
const EXPERT_CASES = `${STAFF_API_V1}/os/expert-cases`;
const DASHBOARD_TTL_MS = 30_000;

export type ExpertCaseAvailability = 'accepting' | 'paused' | 'draining' | 'offline';
export type ExpertCasePriorityTier = 'emergency' | 'sla_risk' | 'standard';
export type ExpertCaseAssignmentStatus =
  | 'queued'
  | 'offered'
  | 'accepted'
  | 'working'
  | 'waiting_external'
  | 'completed'
  | 'intervention_required';

export type {
  ExpertCaseBriefing,
  ExpertCaseReviewDraft as ExpertCaseDraft,
  ExpertCaseValidations,
  ExpertCompatibilityRow,
} from '../expert-case/case-review-contract.js';
import type {
  ExpertCaseBriefing,
  ExpertCaseReviewDraft,
} from '../expert-case/case-review-contract.js';
type ExpertCaseDraft = ExpertCaseReviewDraft;

export type ExpertCaseQueueItem = {
  id: string;
  farmer_id: string;
  block_id?: string | null;
  crop_type?: string | null;
  primary_issue_label?: string | null;
  status: string;
  review_flag: string;
  priority_tier: ExpertCasePriorityTier;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  sla_due_at?: string | null;
  owner_email?: string | null;
  lease_token?: string | null;
  lease_expires_at?: string | null;
  assignment_status: ExpertCaseAssignmentStatus;
  queue_route?: 'desk' | 'field';
  queue_weight?: number;
  queue_score?: number;
  current_revision: number;
  metadata?: Record<string, unknown>;
  opened_at?: string;
  updated_at?: string;
};

export type ExpertCaseCapacity = {
  employee_email: string;
  availability: ExpertCaseAvailability;
  max_active_cases: number;
  max_active_weight: number;
  active_case_count: number;
  active_weight: number;
  paused_until?: string | null;
  pause_reason?: string | null;
};

export type ExpertCaseQueue = {
  enabled: boolean;
  buckets: {
    my_work: ExpertCaseQueueItem[];
    available: ExpertCaseQueueItem[];
    at_risk: ExpertCaseQueueItem[];
    intervention: ExpertCaseQueueItem[];
  };
  capacity?: ExpertCaseCapacity;
};

export type ExpertCaseChatTurn = {
  id: string;
  case_id: string;
  turn_index: number;
  role: 'agronomist' | 'assistant' | 'system' | 'farmer';
  content: string;
  actor_email?: string | null;
  base_revision?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type ExpertCasePendingDraft = {
  id: string;
  case_id: string;
  base_revision: number;
  draft_revision: number;
  status: 'pending' | 'approved' | 'rejected' | 'superseded' | 'safety_rejected';
  draft_json: ExpertCaseDraft;
  created_at: string;
  updated_at: string;
};

export type ExpertCaseSafetyDecision = {
  id: string;
  decision: 'PASS' | 'UNRESOLVED' | 'REJECT' | 'OVERRIDDEN';
  blockers?: Array<{ code?: string; message?: string }>;
  warnings?: Array<{ code?: string; message?: string }>;
  recommendation_revision: string;
  created_at: string;
};

export type ExpertCaseNavItem = {
  id: string;
  caseCode: string;
  farmerName: string | null;
  cropType: string | null;
  priority: string | null;
  primaryIssue: string | null;
  assignmentStatus: string | null;
  bucket: 'my_work' | 'available' | 'at_risk';
};

export type ExpertCaseNavigation = {
  currentIndex: number;
  total: number;
  previousCaseId: string | null;
  nextCaseId: string | null;
  items: ExpertCaseNavItem[];
};

export type ExpertCaseDetail = {
  enabled: boolean;
  expertCase: ExpertCaseQueueItem;
  revisions: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  turns: ExpertCaseChatTurn[];
  draft: ExpertCasePendingDraft | null;
  safety: ExpertCaseSafetyDecision | null;
  briefing?: ExpertCaseBriefing | null;
  nextCaseId?: string | null;
  previousCaseId?: string | null;
  caseNavigation?: ExpertCaseNavigation | null;
};

export const agronomistClient = {
  async getDashboard(opts?: { force?: boolean }): Promise<AgronomistDashboard> {
    return fetchWithCache(
      'agronomist-dashboard',
      DASHBOARD_TTL_MS,
      async () => {
        const r = await staffApi<{ ok: boolean; dashboard: AgronomistDashboard }>(`${AGRO}/mobile/dashboard`);
        const dashboard = r.dashboard;
        return {
          ...dashboard,
          focusFarmers: dedupeBy(dashboard.focusFarmers ?? [], (f) => f.farmerId),
        };
      },
      opts
    );
  },

  async searchFarmers(q: string, limit = 20): Promise<AgronomistFarmerSearchRow[]> {
    const r = await staffApi<{ ok: boolean; farmers: AgronomistFarmerSearchRow[] }>(
      `${FIELD}/farmers/search?q=${encodeURIComponent(q)}&limit=${limit}`
    );
    return dedupeBy(r.farmers ?? [], (f) => f.id);
  },

  async listFarmers(opts?: {
    q?: string;
    filter?: string;
    crop?: string;
    village?: string;
    lat?: number;
    lng?: number;
    limit?: number;
  }): Promise<AgronomistFarmerSearchRow[]> {
    const params = new URLSearchParams();
    if (opts?.q) params.set('q', opts.q);
    if (opts?.filter) params.set('filter', opts.filter);
    if (opts?.crop) params.set('crop', opts.crop);
    if (opts?.village) params.set('village', opts.village);
    if (opts?.lat != null) params.set('lat', String(opts.lat));
    if (opts?.lng != null) params.set('lng', String(opts.lng));
    if (opts?.limit) params.set('limit', String(opts.limit));
    const r = await staffApi<{ ok: boolean; farmers: AgronomistFarmerSearchRow[] }>(
      `${AGRO}/mobile/farmers?${params}`
    );
    return dedupeBy(r.farmers ?? [], (f) => f.id);
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

  async getWorkspaceDashboard(farmerId: string): Promise<FarmerWorkspaceDashboard> {
    const r = await staffApi<{ ok: boolean; dashboard: FarmerWorkspaceDashboard }>(
      `${AGRO}/farmers/${farmerId}/workspace-dashboard`
    );
    return r.dashboard;
  },

  async listFarmerVisits(
    farmerId: string,
    options: { limit?: number; status?: 'open' | 'monitoring' | 'resolved'; blockId?: string } = {}
  ): Promise<FarmerFieldFindingRow[]> {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 30));
    if (options.status) params.set('status', options.status);
    if (options.blockId) params.set('blockId', options.blockId);
    const r = await staffApi<{ ok: boolean; visits: FarmerFieldFindingRow[] }>(
      `${AGRO}/farmers/${farmerId}/visits?${params.toString()}`
    );
    return r.visits ?? [];
  },

  async listFarmerOrders(farmerId: string) {
    const r = await staffApi<{ ok: boolean; orders?: FarmerOrderRow[]; items?: FarmerOrderRow[] }>(
      `${AGRO}/farmers/${farmerId}/orders`
    );
    return r.orders ?? r.items ?? [];
  },

  async listWhatsAppHistory(farmerId: string) {
    const r = await staffApi<{ ok: boolean; messages: Array<{ id: string; summary: string; at: string; by: string | null }> }>(
      `${AGRO}/farmers/${farmerId}/whatsapp-history`
    );
    return r.messages ?? [];
  },

  async logFarmerCall(farmerId: string, body: { outcome?: string; notes?: string; durationSeconds?: number }) {
    return staffApi(`${AGRO}/farmers/${farmerId}/calls`, { method: 'POST', body: JSON.stringify(body) });
  },

  async listCrmMasters(
    type: string,
    opts?: { parentId?: string | null; search?: string }
  ): Promise<Array<{ id: string; name: string; master_type: string; sort_order?: number }>> {
    const params = new URLSearchParams({ type });
    if (opts?.parentId) params.set('parentId', opts.parentId);
    if (opts?.search?.trim()) params.set('search', opts.search.trim());
    const r = await staffApi<{
      ok: boolean;
      items: Array<{ id: string; name: string; master_type: string; sort_order?: number }>;
    }>(`${AGRO}/crm-masters?${params}`);
    return r.items ?? [];
  },

  async createFarmerReminder(
    farmerId: string,
    body: { reason: string; dueAt?: string; assignTo?: 'agronomist' | 'telecaller' }
  ) {
    return staffApi(`${AGRO}/farmers/${farmerId}/reminders`, { method: 'POST', body: JSON.stringify(body) });
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

  async getRecommendationVisitContext(recommendationId: string): Promise<RecommendationVisitContext> {
    const r = await staffApi<{ ok: boolean; context: RecommendationVisitContext }>(
      `${AGRO}/recommendations/${recommendationId}/visit-context`
    );
    return r.context;
  },

  async getEscalationVisitContext(escalationId: string): Promise<RecommendationVisitContext> {
    const r = await staffApi<{ ok: boolean; context: RecommendationVisitContext }>(
      `${AGRO}/escalations/${escalationId}/visit-context`
    );
    return r.context;
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
      farmContext?: import('../visit-wizard/index.js').VisitFarmContext;
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
    return dedupeBy(r.tasks ?? [], (t) => t.id);
  },

  async getExpertCaseQueue(): Promise<ExpertCaseQueue> {
    const r = await staffApi<{ ok: boolean } & ExpertCaseQueue>(`${EXPERT_CASES}/queue`);
    return {
      enabled: Boolean(r.enabled),
      buckets: {
        my_work: r.buckets?.my_work ?? [],
        available: r.buckets?.available ?? [],
        at_risk: r.buckets?.at_risk ?? [],
        intervention: r.buckets?.intervention ?? [],
      },
      capacity: r.capacity,
    };
  },

  async updateExpertCapacity(body: {
    availability: ExpertCaseAvailability;
    reason?: string;
    pausedUntil?: string | null;
  }): Promise<void> {
    await staffApi(`${EXPERT_CASES}/capacity`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async getExpertCase(id: string): Promise<ExpertCaseDetail> {
    return staffApi<ExpertCaseDetail & { ok: boolean }>(
      `${EXPERT_CASES}/${encodeURIComponent(id)}`
    );
  },

  async getExpertCaseNavigation(id: string): Promise<ExpertCaseNavigation> {
    const r = await staffApi<{
      ok: boolean;
      caseNavigation: ExpertCaseNavigation | null;
    }>(`${EXPERT_CASES}/${encodeURIComponent(id)}/navigation`);
    return (
      r.caseNavigation ?? {
        currentIndex: 0,
        total: 0,
        previousCaseId: null,
        nextCaseId: null,
        items: [],
      }
    );
  },

  async claimExpertCase(id: string, reason?: string) {
    const r = await staffApi<{
      ok: boolean;
      ownership: { caseId: string; leaseToken: string; leaseExpiresAt: string };
    }>(`${EXPERT_CASES}/${encodeURIComponent(id)}/claim`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return r.ownership;
  },

  async heartbeatExpertCase(id: string, leaseToken: string) {
    const r = await staffApi<{
      ok: boolean;
      lease: { leaseExpiresAt: string };
    }>(`${EXPERT_CASES}/${encodeURIComponent(id)}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ leaseToken }),
    });
    return r.lease;
  },

  async releaseExpertCase(
    id: string,
    body: { leaseToken?: string; reason?: string; interruption?: boolean } = {}
  ): Promise<void> {
    await staffApi(`${EXPERT_CASES}/${encodeURIComponent(id)}/release`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getExpertCaseChat(id: string) {
    return staffApi<{
      ok: boolean;
      enabled: boolean;
      turns: ExpertCaseChatTurn[];
      draft: ExpertCasePendingDraft | null;
    }>(`${EXPERT_CASES}/${encodeURIComponent(id)}/chat`);
  },

  async postExpertCaseChat(
    id: string,
    content: string,
    leaseToken?: string | null,
    uiLocale?: string | null
  ) {
    return staffApi<{
      ok: boolean;
      agronomistTurn: ExpertCaseChatTurn;
      assistantTurn: ExpertCaseChatTurn;
      draft: ExpertCaseDraft;
      clarification: string | null;
      baseRevision: number;
      navigation?: {
        action: 'next' | 'previous' | 'list';
        targetCaseId: string | null;
        caseNavigation?: ExpertCaseNavigation;
      };
    }>(`${EXPERT_CASES}/${encodeURIComponent(id)}/chat`, {
      method: 'POST',
      body: JSON.stringify({ content, leaseToken, uiLocale: uiLocale ?? undefined }),
    });
  },

  async approveExpertCaseDraft(
    id: string,
    body: {
      leaseToken?: string | null;
      expectedBaseRevision: number;
      draftPatch?: ExpertCaseDraft;
    }
  ) {
    return staffApi<{
      ok: boolean;
      draft: ExpertCaseDraft;
      draftId: string;
      baseRevision: number;
    }>(`${EXPERT_CASES}/${encodeURIComponent(id)}/draft/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async evaluateExpertCaseSafety(
    id: string,
    body: {
      recommendationRevision: string;
      validation: VisitAssistantRecommendationValidationRequest;
      unstructured?: {
        recommendationText?: string | null;
        dosage?: string | null;
        cropType?: string | null;
        applicationType?: string | null;
        phiDays?: number | null;
        reiHours?: number | null;
      };
    }
  ) {
    return staffApi<{
      ok: boolean;
      result: {
        decision: ExpertCaseSafetyDecision['decision'];
        decisionId: string;
        blockers: Array<{ code?: string; message?: string }>;
        warnings: Array<{ code?: string; message?: string }>;
      };
    }>(`${EXPERT_CASES}/${encodeURIComponent(id)}/safety`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async commitExpertCase(
    id: string,
    body: {
      idempotencyKey: string;
      leaseToken?: string | null;
      expectedRevision: number;
      draft: ExpertCaseDraft;
      safetyDecisionId?: string | null;
      closeCase?: boolean;
      summary?: Record<string, unknown>;
    }
  ) {
    return staffApi<{
      ok: boolean;
      result: {
        commandId: string;
        caseId: string;
        revision: number;
        closed: boolean;
        communicationIntentId?: string | null;
        knowledgeCandidateId?: string | null;
      };
    }>(`${EXPERT_CASES}/${encodeURIComponent(id)}/commit`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
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

  async completeOperationsTask(taskId: string) {
    return staffApi(`${AGRO}/operations/tasks/${taskId}/complete`, { method: 'PATCH', body: '{}' });
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

  async getMeasurementTemplates(cropType: string): Promise<MeasurementTemplate[]> {
    const r = await staffApi<{ ok: boolean; templates: MeasurementTemplate[] }>(
      `${FIELD}/measurement-templates/${encodeURIComponent(cropType)}`
    );
    return r.templates ?? [];
  },

  async searchIssueMaster(opts?: {
    category?: IssueCategory;
    cropType?: string;
    q?: string;
  }): Promise<IssueMasterRow[]> {
    const params = new URLSearchParams();
    if (opts?.category) params.set('category', opts.category);
    if (opts?.cropType) params.set('cropType', opts.cropType);
    if (opts?.q) params.set('q', opts.q);
    const r = await staffApi<{ ok: boolean; items: IssueMasterRow[] }>(
      `${FIELD}/issue-master?${params}`
    );
    return r.items ?? [];
  },

  async createIssueMaster(input: {
    category: IssueCategory;
    issueName: string;
    cropType?: string;
    conceptCode?: string;
  }): Promise<IssueMasterRow> {
    const r = await staffApi<{ ok: boolean; row: Record<string, unknown> }>(`${FIELD}/masters/issue`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const row = r.row;
    return {
      id: String(row.id),
      category: String(row.category) as IssueCategory,
      issueName: String(row.issue_name ?? row.issueName),
      conceptCode: row.concept_code ? String(row.concept_code) : null,
      cropType: row.crop_type ? String(row.crop_type) : null,
    };
  },

  async submitStructuredVisit(body: StructuredFieldVisitPayload) {
    return staffApi<{ ok: boolean; findingId: string; recommendationIds: string[] }>(
      `${FIELD}/visits/v2`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  },

  async extractVisitAssistantProposal(body: {
    farmerId: string;
    blockId: string;
    sessionId?: string;
    snapshot: VisitAssistantSnapshot;
    message: { id: string; content: string; createdAt: string };
  }): Promise<VisitAssistantProposalResponse> {
    const r = await staffApi<{ ok: boolean; proposal: VisitAssistantProposalResponse }>(
      `${FIELD}/visits/assistant/extract`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    return r.proposal;
  },

  async postVisitCopilotChat(body: {
    farmerId: string;
    blockId: string;
    sessionId?: string;
    snapshot: VisitAssistantSnapshot;
    message: { id: string; content: string; createdAt: string };
    workflow?: VisitCopilotWorkflowState | null;
  }): Promise<VisitCopilotChatResponse> {
    return staffApi<VisitCopilotChatResponse>(`${FIELD}/visits/copilot/chat`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async validateVisitAssistantRecommendations(
    body: VisitAssistantRecommendationValidationRequest
  ): Promise<VisitAssistantRecommendationValidationResult> {
    return staffApi<VisitAssistantRecommendationValidationResult>(
      `${FIELD}/visits/assistant/validate-recommendations`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  },

  async buildVisitAiContext(body: {
    farmerId: string;
    blockId: string;
    sessionId?: string;
    blockAssessment?: StructuredFieldVisitPayload['blockAssessment'];
    measurements?: StructuredFieldVisitPayload['measurements'];
    latitude?: number;
    longitude?: number;
  }): Promise<VisitAiContextPack> {
    const r = await staffApi<{ ok: boolean; context: VisitAiContextPack }>(
      `${FIELD}/visits/context`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    return r.context;
  },

  async analyzeVisitIssue(body: {
    farmerId: string;
    blockId: string;
    sessionId?: string;
    issueCategory: IssueCategory;
    issueName: string;
    observation?: string;
    blockAssessment?: StructuredFieldVisitPayload['blockAssessment'];
    measurements?: StructuredFieldVisitPayload['measurements'];
    latitude?: number;
    longitude?: number;
    selectedHypothesisLabel?: string;
    analyzePhotos?: Array<{ dataBase64: string; mimeType?: string }>;
  }): Promise<VisitAnalyzeResponse> {
    const r = await staffApi<{ ok: boolean } & VisitAnalyzeResponse>(
      `${FIELD}/visits/analyze`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    return {
      aiCaseId: r.aiCaseId,
      hypotheses: r.hypotheses,
      confidenceAction: r.confidenceAction,
      skipFollowUpOptional: r.skipFollowUpOptional,
      imageSignal: r.imageSignal ?? null,
      similarCases: r.similarCases ?? [],
    };
  },

  async triagePreview(body: {
    farmerId: string;
    blockId: string;
    blockAssessment?: StructuredFieldVisitPayload['blockAssessment'];
    measurements?: StructuredFieldVisitPayload['measurements'];
    analyzePhotos?: Array<{ dataBase64: string; mimeType?: string }>;
  }) {
    const r = await staffApi<{
      ok: boolean;
      triage: import('../visit-wizard/step-flow.js').TriagePreview;
      capability: { capable: boolean; diagnosisDegraded: boolean };
    }>(`${FIELD}/visits/triage-preview`, { method: 'POST', body: JSON.stringify(body) });
    return { triage: r.triage, capability: r.capability };
  },

  async getPlotIntelligence(blockId: string) {
    const r = await staffApi<{ ok: boolean; trends: Record<string, unknown> }>(
      `${FIELD}/blocks/${encodeURIComponent(blockId)}/plot-intelligence`
    );
    return r.trends;
  },

  async previewRecommendationOptions(body: { issueLabel: string; cropType: string; farmerSegment?: string }) {
    const r = await staffApi<{ ok: boolean; options: Array<Record<string, unknown>> }>(
      `${FIELD}/visits/recommendation-options/preview`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    return r.options ?? [];
  },

  async copilotAsk(body: { question: string; aiCaseId?: string; farmerId?: string; blockId?: string; cropType?: string; issueName?: string }) {
    const r = await staffApi<{ ok: boolean; answer: string; citations: string[] }>(
      `/morbeez-staff/api/v1/os/agronomist/copilot/ask`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    return { answer: r.answer, citations: r.citations ?? [] };
  },

  async explainDiagnosis(body: {
    issueName: string;
    finalDiagnosis?: string;
    observation?: string;
    severity?: string;
    rootCause?: { symptoms?: string[]; immediateCause?: string; rootCause?: string };
    hypotheses?: Array<{ label: string; confidence: number; rationale?: string }>;
  }) {
    const r = await staffApi<{ ok: boolean; farmerText: string; agronomistText: string }>(
      `${FIELD}/visits/explain-diagnosis`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    return { farmerText: r.farmerText, agronomistText: r.agronomistText };
  },

  async updateVisitPriority(findingId: string, priority: 'normal' | 'urgent' | 'emergency') {
    const r = await staffApi<{ ok: boolean; id: string; priority: string }>(
      `${AGRO}/field-findings/${encodeURIComponent(findingId)}/priority`,
      { method: 'PATCH', body: JSON.stringify({ priority }) }
    );
    return { id: r.id, priority: r.priority };
  },

  async getVisitCommandCenter() {
    const r = await staffApi<{
      ok: boolean;
      center: {
        priorityQueue: Array<{ id: string; farmerName: string; priority: string }>;
        summary: {
          todaysVisits: number;
          openIssues: number;
          priorityCount: number;
          openEscalations: number;
        };
      };
    }>(`${AGRO}/operations/visit-command-center`);
    return r.center;
  },

  async whyDiagnosis(aiCaseId: string) {
    const r = await staffApi<{ ok: boolean; answer: string; citations: string[] }>(
      `${AGRO}/copilot/why-diagnosis`,
      { method: 'POST', body: JSON.stringify({ aiCaseId }) }
    );
    return { answer: r.answer, citations: r.citations ?? [] };
  },

  async getFarmer360(farmerId: string) {
    const r = await staffApi<{ ok: boolean; profile: Record<string, unknown> }>(
      `${STAFF_API_V1}/os/intelligence/farmers/${encodeURIComponent(farmerId)}/360`
    );
    return r.profile;
  },

  async listProtocols(cropType?: string) {
    const qs = cropType ? `?crop=${encodeURIComponent(cropType)}` : '';
    const r = await staffApi<{ ok: boolean; protocols: Array<Record<string, unknown>> }>(
      `${STAFF_API_V1}/os/protocols${qs}`
    );
    return r.protocols ?? [];
  },

  async analyzeVisit(body: {
    farmerId: string;
    blockId: string;
    sessionId?: string;
    blockAssessment?: StructuredFieldVisitPayload['blockAssessment'];
    measurements?: StructuredFieldVisitPayload['measurements'];
    latitude?: number;
    longitude?: number;
    fieldVoiceNote?: string;
    analyzePhotos?: Array<{ dataBase64: string; mimeType?: string; photoType?: string }>;
    purpose?: 'screening' | 'full';
  }) {
    const r = await staffApi<{
      ok: boolean;
      issues: Array<import('../visit-wizard/index.js').VisitIssueDraft>;
      triage?: import('../visit-wizard/step-flow.js').TriagePreview;
      insufficientEvidence?: boolean;
    }>(`${FIELD}/visits/analyze-visit`, { method: 'POST', body: JSON.stringify(body) });
    return { issues: r.issues ?? [], triage: r.triage, insufficientEvidence: r.insufficientEvidence };
  },

  async previewMonitoringPlan(body: {
    issues: Array<{ localId: string; issueName: string; severity: import('../types/field-findings.js').RecordSeverity }>;
    recommendationGroups?: import('../visit-wizard/index.js').RecommendationGroupDraft[];
  }) {
    const r = await staffApi<{
      ok: boolean;
      items: import('../visit-wizard/index.js').MonitoringPlanPreviewItem[];
    }>(`${FIELD}/visits/monitoring-plan/preview`, { method: 'POST', body: JSON.stringify(body) });
    return r.items ?? [];
  },

  async previewWhatsappMessages(body: {
    farmerId: string;
    blockName?: string;
    recommendationGroups?: import('../visit-wizard/index.js').RecommendationGroupDraft[];
    reviewDate?: string;
    monitoringInterval?: string;
    issues: Array<{
      issueName: string;
      finalDiagnosis?: string;
      finalRecommendation?: string;
      initialRecommendation?: { text: string; dose?: string; method?: string };
    }>;
  }) {
    const r = await staffApi<{
      ok: boolean;
      messages: import('../visit-wizard/index.js').WhatsappPreviewMessage[];
    }>(`${FIELD}/visits/whatsapp-preview`, { method: 'POST', body: JSON.stringify(body) });
    return r.messages ?? [];
  },

  async skipVisitAiFollowUp(aiCaseId: string) {
    return staffApi<{ ok: boolean; skipped: boolean }>(
      `${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/skip-qa`,
      { method: 'POST' }
    );
  },

  async getVisitAiCaseDetail(aiCaseId: string) {
    const r = await staffApi<{ ok: boolean; case: import('../types/field-findings.js').VisitAiCaseDetail }>(
      `${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}`
    );
    return r.case;
  },

  async getVisitAiQuestions(aiCaseId: string): Promise<VisitAiQuestion[]> {
    const r = await staffApi<{ ok: boolean; questions: VisitAiQuestion[] }>(
      `${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/questions`
    );
    return r.questions ?? [];
  },

  async saveVisitAiAnswers(aiCaseId: string, answers: Array<{ questionId: string; answer: string }>) {
    return staffApi(`${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/questions`, {
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
      options?: string[];
      priority?: number;
      imageTarget?: string;
    }>
  ): Promise<VisitAiQuestion[]> {
    const r = await staffApi<{ ok: boolean; questions: VisitAiQuestion[] }>(
      `${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/questions`,
      {
        method: 'PUT',
        body: JSON.stringify({ questions }),
      }
    );
    return r.questions ?? [];
  },

  async regenerateVisitAiQuestions(aiCaseId: string): Promise<VisitAiQuestion[]> {
    const r = await staffApi<{ ok: boolean; questions: VisitAiQuestion[] }>(
      `${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/questions/regenerate`,
      { method: 'POST' }
    );
    return r.questions ?? [];
  },

  async reanalyzeVisitAiCase(aiCaseId: string) {
    return staffApi<{
      ok: boolean;
      finalDiagnosis: string;
      finalConfidence: number;
      confidenceAction: string;
      hypotheses: Array<{ label: string; confidence: number; rationale?: string }>;
    }>(`${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/reanalyze`, { method: 'POST' });
  },

  async screenVisitAiCase(aiCaseId: string) {
    return staffApi<{
      ok: boolean;
      distribution: {
        hypotheses: Array<{ label: string; weight: number }>;
        unknownWeight: number;
        topConfidence: number;
        targetConfidence: number;
      };
      thresholdReached: boolean;
      topLabel: string | null;
      confidenceAction: string;
      nextQuestion: { id: string; questionText: string; answerType: string } | null;
    }>(`${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/screen`, { method: 'POST' });
  },

  async applyVisitAiAnswer(aiCaseId: string, questionId: string, answer: string) {
    return staffApi<{
      ok: boolean;
      distribution: {
        hypotheses: Array<{ label: string; weight: number }>;
        unknownWeight: number;
        topConfidence: number;
        targetConfidence: number;
      };
      thresholdReached: boolean;
      topLabel: string | null;
      confidenceAction: string;
      nextQuestion: { id: string; questionText: string; answerType: string } | null;
      deltas: Array<{ label: string; delta: number }>;
    }>(`${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, answer }),
    });
  },

  async getVisitAiConfidenceState(aiCaseId: string) {
    return staffApi<{
      ok: boolean;
      distribution: {
        hypotheses: Array<{ label: string; weight: number }>;
        unknownWeight: number;
        topConfidence: number;
        targetConfidence: number;
      };
      thresholdReached: boolean;
      topLabel: string | null;
      confidenceAction: string;
      nextQuestion: { id: string; questionText: string; answerType: string } | null;
    }>(`${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/confidence-state`);
  },

  async upsertVisitDraft(
    sessionId: string,
    body: {
      farmerId: string;
      blockId?: string;
      currentStep: string;
      wizardVersion?: string;
      payload: Record<string, unknown>;
      photoRefs?: Array<{ storagePath: string; photoType: string; mimeType: string; filename?: string }>;
    }
  ) {
    return staffApi<{ ok: boolean; draft: Record<string, unknown> }>(
      `${FIELD}/visits/sessions/${encodeURIComponent(sessionId)}/draft`,
      { method: 'PUT', body: JSON.stringify(body) }
    );
  },

  async getVisitDraft(sessionId: string) {
    return staffApi<{ ok: boolean; draft: Record<string, unknown> | null }>(
      `${FIELD}/visits/sessions/${encodeURIComponent(sessionId)}/draft`
    );
  },

  async listVisitDrafts(limit = 20) {
    return staffApi<{ ok: boolean; drafts: Array<Record<string, unknown>> }>(
      `${FIELD}/visits/drafts?limit=${limit}`
    );
  },

  async getFarmerApplicationHistory(farmerId: string, blockId: string) {
    return staffApi<{ ok: boolean; rows: Array<Record<string, unknown>> }>(
      `/morbeez-staff/api/v1/os/farmers/${encodeURIComponent(farmerId)}/application-history?blockId=${encodeURIComponent(blockId)}`
    );
  },

  async deleteVisitDraft(sessionId: string) {
    return staffApi<{ ok: boolean }>(
      `${FIELD}/visits/sessions/${encodeURIComponent(sessionId)}/draft`,
      { method: 'DELETE' }
    );
  },

  async recommendVisitAiCase(aiCaseId: string, finalDiagnosis?: string) {
    return staffApi<{
      ok: boolean;
      recommendationId: string;
      text: string;
      dosage: string | null;
      priority: string;
      reviewAfterDays: number;
      reviewDate: string;
      expectedImprovementDays: string;
    }>(`${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/recommend`, {
      method: 'POST',
      body: JSON.stringify({ finalDiagnosis }),
    });
  },

  async rejectVisitAiRecommendation(
    aiCaseId: string,
    body: {
      reason: VisitAiRejectReason;
      correctedDiagnosis?: string;
      rejectNote?: string;
      editedRecommendation?: string;
      evidenceRequest?: VisitAiEvidenceRequest;
      customRecommendation?: VisitAiCustomRecommendation;
    }
  ) {
    return staffApi<{
      ok: boolean;
      status: string;
      finalDiagnosis?: string;
      finalRecommendation?: string;
      dosage?: string | null;
      reviewAfterDays?: number;
      reviewAction?: string;
      whatsappSent?: boolean;
      customRecommendation?: VisitAiCustomRecommendation;
    }>(`${FIELD}/visits/ai-case/${encodeURIComponent(aiCaseId)}/reject`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getSimilarVisitCases(farmerId: string, cropType: string, issueName: string) {
    const params = new URLSearchParams({ farmerId, cropType, issueName });
    const r = await staffApi<{
      ok: boolean;
      cases: Array<{ issueLabel: string; score: number; confidence: number }>;
    }>(`${FIELD}/visits/similar-cases?${params}`);
    return r.cases ?? [];
  },

  async searchVisitCaseLibrary(opts?: {
    cropType?: string;
    issue?: string;
    outcome?: string;
    dapBucket?: string;
    severity?: string;
    reviewAction?: string;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (opts?.cropType) params.set('cropType', opts.cropType);
    if (opts?.issue) params.set('issue', opts.issue);
    if (opts?.outcome) params.set('outcome', opts.outcome);
    if (opts?.dapBucket) params.set('dapBucket', opts.dapBucket);
    if (opts?.severity) params.set('severity', opts.severity);
    if (opts?.reviewAction) params.set('reviewAction', opts.reviewAction);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const r = await staffApi<{ ok: boolean; cases: unknown[] }>(
      `${FIELD}/visits/case-library?${params}`
    );
    return r.cases ?? [];
  },

  async getVisitDetail(findingId: string) {
    return staffApi<{ ok: boolean; finding: Record<string, unknown>; issues: unknown[]; measurements: unknown[]; recommendations: unknown[] }>(
      `${FIELD}/visits/${findingId}`
    );
  },

  async listFarmerFieldFindings(farmerId: string, limit = 30) {
    const r = await staffApi<{ ok: boolean; findings: unknown[] }>(
      `${FIELD}/farmers/${farmerId}/field-findings?limit=${limit}`
    );
    return r.findings ?? [];
  },

  async suggestIssueFollowUpQuestions(body: {
    issueCategory: IssueCategory;
    issueName: string;
    cropType: string;
    dap?: number;
    observation?: string;
    recommendationText?: string;
    photoCount?: number;
  }) {
    const r = await staffApi<{ ok: boolean; questions: string[] }>(
      `${FIELD}/issue-follow-up-questions`,
      { method: 'POST', body: JSON.stringify(body) }
    );
    return r.questions ?? [];
  },

  async validateVisitPhoto(dataBase64: string, mimeType?: string) {
    return staffApi<import('../visit-wizard/index.js').VisitPhotoValidationResult & { ok: boolean }>(
      `${FIELD}/visits/photos/validate`,
      { method: 'POST', body: JSON.stringify({ dataBase64, mimeType }) }
    );
  },

  async classifyVisitPhoto(body: {
    dataBase64: string;
    mimeType?: string;
    cropType: string;
    availableTypes: string[];
    caption?: string;
  }) {
    const r = await staffApi<{
      ok: boolean;
      classification: {
        photoType: string;
        confidence: number;
        source: 'vision' | 'heuristic';
        label?: string;
      } | null;
    }>(`${FIELD}/visits/photos/classify`, { method: 'POST', body: JSON.stringify(body) });
    return r.classification;
  },

  async getVisitEnvironment(farmerId: string, blockId: string) {
    const params = new URLSearchParams({ farmerId, blockId });
    return staffApi<import('../visit-wizard/index.js').VisitEnvironmentPayload & { ok: boolean }>(
      `${FIELD}/visits/environment?${params}`
    );
  },

  async checkRecommendationCompatibility(body: {
    productA?: string;
    productB?: string;
    materials?: Array<{ technicalName: string }>;
  }) {
    return staffApi<{
      ok: boolean;
      pair?: Record<string, unknown>;
      pairs?: Array<Record<string, unknown>>;
      hasIncompatiblePair?: boolean;
      hasUnknownPair?: boolean;
    }>(`${FIELD}/visits/recommendations/compatibility-check`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async closeVisitCase(
    findingId: string,
    body: { notes?: string; learningConsent?: boolean; issueResolved?: boolean; outcome?: string }
  ) {
    return staffApi(`${FIELD}/visits/${findingId}/close-case`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async exportVisitTrainingBundle(findingId: string) {
    return staffApi<{ ok: boolean; bundle: Record<string, unknown> }>(
      `${FIELD}/visits/${findingId}/training-bundle`
    );
  },

  async listFarmerNotes(farmerId: string): Promise<FarmerNoteRow[]> {
    const r = await staffApi<{ ok: boolean; notes: FarmerNoteRow[] }>(`${AGRO}/farmers/${farmerId}/notes`);
    return r.notes ?? [];
  },

  async addFarmerNote(farmerId: string, noteText: string) {
    return staffApi(`${AGRO}/farmers/${farmerId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ noteText }),
    });
  },

  async getFarmerFollowUps(farmerId: string): Promise<FollowUpBundle> {
    const r = await staffApi<{ ok: boolean } & FollowUpBundle>(`${AGRO}/farmers/${farmerId}/follow-ups`);
    return {
      tasks: r.tasks ?? [],
      recommendationFollowUps: r.recommendationFollowUps ?? [],
      callbacks: r.callbacks ?? [],
    };
  },

  async listFarmerSoilReports(farmerId: string) {
    const r = await staffApi<{ ok: boolean; reports: PortalSoilReport[] }>(
      `${AGRO}/farmers/${farmerId}/soil-reports`
    );
    return r.reports ?? [];
  },

  async createSoilReport(
    farmerId: string,
    body: { blockId?: string; metrics?: Record<string, unknown>; pdfUrl?: string }
  ) {
    return staffApi(`${AGRO}/farmers/${farmerId}/soil-reports`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async createFieldActivity(
    farmerId: string,
    body: {
      blockId: string;
      activityType: 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'other';
      activityLabel?: string;
      activityDate: string;
      dap?: number;
      notes?: string;
      costInr?: number;
      status?: 'completed' | 'pending' | 'cancelled';
    }
  ) {
    return staffApi(`${AGRO}/farmers/${farmerId}/field-activities`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getFarmerCallLogSummary(farmerId: string): Promise<FarmerCallLogSummary> {
    const r = await staffApi<{ ok: boolean; summary: FarmerCallLogSummary }>(
      `${AGRO}/farmers/${farmerId}/call-log-summary`
    );
    return r.summary;
  },

  async listFarmerInteractions(
    farmerId: string,
    opts?: { leadId?: string; page?: number; limit?: number }
  ): Promise<{ interactions: FarmerInteractionRow[]; pagination: { total: number } }> {
    const params = new URLSearchParams();
    if (opts?.leadId) params.set('leadId', opts.leadId);
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    const q = params.toString();
    const r = await staffApi<{
      ok: boolean;
      interactions: FarmerInteractionRow[];
      pagination: { total: number };
    }>(`${AGRO}/farmers/${farmerId}/interactions${q ? `?${q}` : ''}`);
    return { interactions: r.interactions ?? [], pagination: r.pagination ?? { total: 0 } };
  },

  async getFarmerInteractionDetail(
    farmerId: string,
    interactionId: string,
    leadId?: string
  ) {
    const q = leadId ? `?leadId=${encodeURIComponent(leadId)}` : '';
    return staffApi<{ ok: boolean; interaction: Record<string, unknown> }>(
      `${AGRO}/farmers/${farmerId}/interactions/${encodeURIComponent(interactionId)}${q}`
    );
  },

  async getFarmerTeamTimeline(farmerId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; timeline: Record<string, unknown>[] }>(
      `${AGRO}/farmers/${farmerId}/team-timeline`
    );
    return r.timeline ?? [];
  },

  async addFarmerTeamComment(farmerId: string, body: string): Promise<void> {
    await staffApi(`${AGRO}/farmers/${farmerId}/team-timeline`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  async listNotifications(): Promise<
    Array<{
      id: string;
      category: string;
      title: string;
      detail?: string | null;
      at: string;
      farmerId?: string;
    }>
  > {
    const r = await staffApi<{
      ok: boolean;
      notifications: Array<{
        id: string;
        category: string;
        title: string;
        detail?: string | null;
        at: string;
        farmerId?: string;
      }>;
    }>(`${AGRO}/mobile/notifications`);
    return dedupeBy(r.notifications ?? [], (n) => n.id);
  },
};
