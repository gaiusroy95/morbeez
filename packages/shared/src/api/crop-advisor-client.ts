import { STAFF_API_V1 } from './config';
import { dedupeBy } from '../list-utils';
import { fetchWithCache } from './response-cache';
import { staffApi } from './staff-client';
import type {
  PendingCallUpload,
  CropAdvisorActionQueueItem,
  CropAdvisorCallRow,
  CropAdvisorDashboard,
  CropAdvisorFollowUpSections,
  CropAdvisorLeadRow,
  CropAdvisorNotification,
  CropAdvisorOperationalLeadRow,
  CropAdvisorQueueSummary,
  CropAdvisorTaskRow,
  CropAdvisorTimelineItem,
  CropAdvisorWorkspaceSummary,
} from '../types/crop-advisor';
import type { FarmerInteractionRow } from '../types/interactions';
import { EMPTY_CROP_ADVISOR_DASHBOARD } from '../types/crop-advisor';

const CA_API = `${STAFF_API_V1}/os/crop-advisor`;
const DASHBOARD_TTL_MS = 30_000;
const OFFLINE_QUEUE_KEY = 'crop_advisor_offline_uploads';

function normalizeDashboard(raw: {
  overview?: Partial<CropAdvisorDashboard['overview']> | null;
  qc?: Partial<CropAdvisorDashboard['qc']> | null;
  queueHealth?: CropAdvisorDashboard['queueHealth'];
  actionQueue?: CropAdvisorDashboard['actionQueue'];
  todaysTasks?: CropAdvisorDashboard['todaysTasks'];
  escalations?: number;
}): CropAdvisorDashboard {
  return {
    overview: { ...EMPTY_CROP_ADVISOR_DASHBOARD.overview, ...(raw.overview ?? {}) },
    qc: { ...EMPTY_CROP_ADVISOR_DASHBOARD.qc, ...(raw.qc ?? {}) },
    queueHealth: raw.queueHealth,
    actionQueue: dedupeBy(raw.actionQueue ?? [], (item) => item.id),
    todaysTasks: dedupeBy(raw.todaysTasks ?? [], (task) => task.id),
    escalations: raw.escalations ?? 0,
  };
}

export const cropAdvisorClient = {
  async getDashboard(opts?: { force?: boolean }): Promise<CropAdvisorDashboard> {
    return fetchWithCache(
      'crop-advisor-dashboard',
      DASHBOARD_TTL_MS,
      async () => {
        try {
          const r = await staffApi<{
            ok: boolean;
            overview?: CropAdvisorDashboard['overview'];
            qc?: CropAdvisorDashboard['qc'];
            queueHealth?: CropAdvisorDashboard['queueHealth'];
            actionQueue?: CropAdvisorActionQueueItem[];
            todaysTasks?: CropAdvisorTaskRow[];
            escalations?: number;
          }>(`${CA_API}/mobile/dashboard`);
          return normalizeDashboard(r);
        } catch {
          const [overviewRes, qcRes] = await Promise.all([
            staffApi<{ ok: boolean; overview: CropAdvisorDashboard['overview'] }>(`${CA_API}/overview`),
            staffApi<{ ok: boolean; overview: CropAdvisorDashboard['qc'] }>(`${CA_API}/qc/overview?days=7`).catch(
              () => ({ ok: true, overview: EMPTY_CROP_ADVISOR_DASHBOARD.qc })
            ),
          ]);
          return normalizeDashboard({
            overview: overviewRes.overview,
            qc: qcRes.overview,
          });
        }
      },
      opts
    );
  },

  async listLeads(opts?: { scope?: 'mine' | 'all'; limit?: number }): Promise<CropAdvisorLeadRow[]> {
    const params = new URLSearchParams();
    params.set('scope', opts?.scope ?? 'mine');
    if (opts?.limit) params.set('limit', String(opts.limit));
    const r = await staffApi<{ ok: boolean; leads: CropAdvisorLeadRow[] }>(
      `${CA_API}/mobile/leads?${params}`
    );
    return dedupeBy(r.leads ?? [], (l) => l.id);
  },

  async listOperationalLeads(opts?: {
    scope?: 'mine' | 'all';
    search?: string;
    smartFilter?: string;
    sort?: string;
    limit?: number;
  }): Promise<CropAdvisorOperationalLeadRow[]> {
    const params = new URLSearchParams();
    params.set('scope', opts?.scope ?? 'mine');
    if (opts?.search) params.set('search', opts.search);
    if (opts?.smartFilter) params.set('smartFilter', opts.smartFilter);
    if (opts?.sort) params.set('sort', opts.sort);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const r = await staffApi<{ ok: boolean; leads: CropAdvisorOperationalLeadRow[] }>(
      `${CA_API}/mobile/leads/operational?${params}`
    );
    return dedupeBy(r.leads ?? [], (l) => l.id);
  },

  async getQueueSummary(scope: 'mine' | 'all' = 'mine'): Promise<CropAdvisorQueueSummary> {
    const r = await staffApi<{ ok: boolean; summary: CropAdvisorQueueSummary }>(
      `${CA_API}/leads/queue-summary?scope=${scope}`
    );
    return r.summary ?? {};
  },

  async listFollowUps(status = 'pending'): Promise<CropAdvisorTaskRow[]> {
    const r = await staffApi<{ ok: boolean; tasks: CropAdvisorTaskRow[] }>(
      `${CA_API}/mobile/follow-ups?status=${encodeURIComponent(status)}`
    );
    return dedupeBy(r.tasks ?? [], (t) => t.id);
  },

  async listFollowUpSections(): Promise<CropAdvisorFollowUpSections> {
    const r = await staffApi<{ ok: boolean; sections: CropAdvisorFollowUpSections }>(
      `${CA_API}/mobile/follow-ups?grouped=true`
    );
    return (
      r.sections ?? {
        today: [],
        overdue: [],
        upcoming: [],
        recommendationReviews: [],
        visitFollowUps: [],
        orderFollowUps: [],
        general: [],
      }
    );
  },

  async listNotifications(): Promise<CropAdvisorNotification[]> {
    const r = await staffApi<{ ok: boolean; notifications: CropAdvisorNotification[] }>(
      `${CA_API}/mobile/notifications`
    );
    return dedupeBy(r.notifications ?? [], (n) => n.id);
  },

  async getLeadDetail(leadId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean } & Record<string, unknown>>(`${CA_API}/leads/${leadId}`);
    return r;
  },

  async getLeadWorkspaceSummary(leadId: string): Promise<CropAdvisorWorkspaceSummary> {
    const r = await staffApi<{ ok: boolean; summary: CropAdvisorWorkspaceSummary }>(
      `${CA_API}/mobile/leads/${leadId}/workspace-summary`
    );
    return r.summary;
  },

  async getLeadFarmerProfile(leadId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean } & Record<string, unknown>>(
      `${CA_API}/leads/${leadId}/farmer-profile`
    );
    return r;
  },

  async getLeadIntelligence(leadId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; profile: Record<string, unknown> }>(
      `${CA_API}/leads/${leadId}/intelligence`
    );
    return r.profile ?? {};
  },

  async listSalesOpportunities(): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; opportunities: Record<string, unknown>[] }>(
      `${CA_API}/mobile/sales-opportunities`
    );
    return r.opportunities ?? [];
  },

  async updateSalesOpportunityStatus(id: string, status: string): Promise<void> {
    await staffApi(`${CA_API}/sales-opportunities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async getLeadTeamTimeline(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; timeline: Record<string, unknown>[] }>(
      `${CA_API}/leads/${leadId}/team-timeline`
    );
    return r.timeline ?? [];
  },

  async addLeadTeamComment(leadId: string, body: string): Promise<void> {
    await staffApi(`${CA_API}/leads/${leadId}/team-timeline`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  async getLeadCrmBundle(leadId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean } & Record<string, unknown>>(`${CA_API}/leads/${leadId}/crm`);
    return r;
  },

  async listLeadInteractions(
    leadId: string,
    opts?: { limit?: number }
  ): Promise<{ interactions: FarmerInteractionRow[] }> {
    const params = opts?.limit ? `?limit=${opts.limit}` : '';
    const r = await staffApi<{ ok: boolean; interactions: FarmerInteractionRow[] }>(
      `${CA_API}/leads/${leadId}/interactions${params}`
    );
    return { interactions: r.interactions ?? [] };
  },

  async createLeadInteraction(
    leadId: string,
    input: {
      interactionType: string;
      blockId?: string;
      summary: string;
      notes?: string;
      interactionAt?: string;
      outcome?: string;
      nextAction?: string;
      nextActionAt?: string;
      workflowStatus?: 'Active' | 'Closed' | 'Escalated';
      addFieldFinding?: boolean;
      findingType?: string;
      severity?: string;
      affectedAreaPct?: number;
      finalConfirmedIssue?: string;
      fieldActivityLabel?: string;
      fieldActivityTypeId?: string;
      fieldActivityDate?: string;
      addFieldActivity?: boolean;
      recommendationSummary?: string;
      recommendationCompleted?: boolean;
      escalate?: boolean;
      status?: string;
    }
  ): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; interaction: Record<string, unknown> }>(
      `${CA_API}/leads/${leadId}/interactions`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    return r.interaction ?? {};
  },

  async getLeadInteractionDetail(
    leadId: string,
    interactionId: string
  ): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; interaction: Record<string, unknown> }>(
      `${CA_API}/leads/${leadId}/interactions/${interactionId}`
    );
    return r.interaction ?? {};
  },

  async listMasters(
    type: string,
    opts?: { parentId?: string | null; search?: string }
  ): Promise<Array<{ id: string; name: string; master_type?: string; sort_order?: number }>> {
    const params = new URLSearchParams({ type });
    if (opts?.parentId) params.set('parentId', opts.parentId);
    if (opts?.search?.trim()) params.set('search', opts.search.trim());
    const r = await staffApi<{
      ok: boolean;
      items: Array<{ id: string; name: string; master_type?: string; sort_order?: number }>;
    }>(`${CA_API}/masters?${params}`);
    return r.items ?? [];
  },

  async createMaster(input: {
    masterType: string;
    name: string;
    parentId?: string | null;
  }): Promise<{ id: string; name: string }> {
    const r = await staffApi<{ ok: boolean; item: { id: string; name: string } }>(`${CA_API}/masters`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return r.item;
  },

  async listFieldActivityTypes(
    leadId: string,
    opts?: { cropType?: string; activeOnly?: boolean }
  ): Promise<Array<{ id: string; activity_name: string; crop?: string | null }>> {
    const params = new URLSearchParams();
    if (opts?.cropType) params.set('cropType', opts.cropType);
    if (opts?.activeOnly != null) params.set('activeOnly', String(opts.activeOnly));
    const q = params.toString();
    const r = await staffApi<{
      ok: boolean;
      types: Array<{ id: string; activity_name: string; crop?: string | null }>;
    }>(`${CA_API}/leads/${leadId}/field-activity-types${q ? `?${q}` : ''}`);
    return r.types ?? [];
  },

  async createFieldActivityType(
    leadId: string,
    input: { activityName: string; crop?: string | null; category?: string }
  ): Promise<{ id: string; activity_name: string }> {
    const r = await staffApi<{ ok: boolean; type: { id: string; activity_name: string } }>(
      `${CA_API}/leads/${leadId}/field-activity-types`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    return r.type;
  },

  async listLeadBlocks(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; blocks: Record<string, unknown>[] }>(
      `${CA_API}/leads/${leadId}/blocks`
    );
    return r.blocks ?? [];
  },

  async getBlockWorkspace(leadId: string, blockId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; workspace: Record<string, unknown> }>(
      `${CA_API}/leads/${leadId}/blocks/${blockId}/workspace`
    );
    return r.workspace ?? {};
  },

  async listLeadRecommendations(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; recommendations: Record<string, unknown>[] }>(
      `${CA_API}/leads/${leadId}/recommendations`
    );
    return r.recommendations ?? [];
  },

  async listLeadOrders(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; orders: Record<string, unknown>[] }>(
      `${CA_API}/leads/${leadId}/orders`
    );
    return r.orders ?? [];
  },

  async getLeadOrder(leadId: string, orderId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; order: Record<string, unknown> }>(
      `${CA_API}/leads/${leadId}/orders/${orderId}`
    );
    return r.order ?? {};
  },

  async listLeadNotes(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; notes: Record<string, unknown>[] }>(
      `${CA_API}/leads/${leadId}/notes`
    );
    return r.notes ?? [];
  },

  async addLeadNote(leadId: string, note: string): Promise<void> {
    await staffApi(`${CA_API}/leads/${leadId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  async createLeadTask(
    leadId: string,
    input: { title: string; dueAt?: string; notes?: string; taskCategory?: string }
  ): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; task: Record<string, unknown> }>(
      `${CA_API}/leads/${leadId}/tasks`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    return r.task ?? {};
  },

  async completeTask(taskId: string): Promise<void> {
    await staffApi(`${CA_API}/tasks/${taskId}/complete`, { method: 'PATCH' });
  },

  async snoozeTask(taskId: string, dueAt: string): Promise<void> {
    await staffApi(`${CA_API}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ dueAt }),
    });
  },

  async listWhatsAppMessages(farmerId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; messages: Record<string, unknown>[] }>(
      `${CA_API}/whatsapp/${farmerId}/messages`
    );
    return r.messages ?? [];
  },

  async uploadCall(input: {
    leadId: string;
    audioBase64: string;
    mimeType: string;
    filename: string;
    outcome?: string;
    durationSeconds?: number;
    recordingProvider?: 'app_upload' | 'voice_note';
  }): Promise<CropAdvisorCallRow> {
    const r = await staffApi<{ ok: boolean; call: CropAdvisorCallRow }>(
      `${CA_API}/leads/${input.leadId}/calls/upload`,
      {
        method: 'POST',
        body: JSON.stringify({
          audioBase64: input.audioBase64,
          mimeType: input.mimeType,
          filename: input.filename,
          outcome: input.outcome ?? 'connected',
          durationSeconds: input.durationSeconds ?? 0,
          recordingProvider: input.recordingProvider ?? 'app_upload',
        }),
      }
    );
    return r.call;
  },

  async getCall(callId: string): Promise<CropAdvisorCallRow> {
    const r = await staffApi<{ ok: boolean; call: CropAdvisorCallRow }>(`${CA_API}/calls/${callId}`);
    return r.call;
  },

  async getLeadTimeline(leadId: string): Promise<CropAdvisorTimelineItem[]> {
    const r = await staffApi<{ ok: boolean; items: CropAdvisorTimelineItem[] }>(
      `${CA_API}/leads/${leadId}/timeline`
    );
    return r.items ?? [];
  },

  async clickToCall(
    leadId: string,
    farmerPhone: string
  ): Promise<{ callLogId: string; mode: 'exotel' | 'native'; dialPhone?: string }> {
    const r = await staffApi<{
      ok: boolean;
      callLogId: string;
      mode?: 'exotel' | 'native';
      dialPhone?: string;
    }>(`${CA_API}/exotel/click-to-call`, {
      method: 'POST',
      body: JSON.stringify({ leadId, farmerPhone }),
    });
    return {
      callLogId: r.callLogId,
      mode: r.mode ?? 'exotel',
      dialPhone: r.dialPhone,
    };
  },

  async queueOfflineUpload(item: Omit<PendingCallUpload, 'id' | 'createdAt'>): Promise<void> {
    const existing = await cropAdvisorClient.listOfflineQueue();
    const next: PendingCallUpload[] = [
      ...existing,
      {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      },
    ];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
    }
  },

  async listOfflineQueue(): Promise<PendingCallUpload[]> {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PendingCallUpload[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async flushOfflineQueue(): Promise<{ uploaded: number; failed: number }> {
    const queue = await cropAdvisorClient.listOfflineQueue();
    if (!queue.length) return { uploaded: 0, failed: 0 };
    let uploaded = 0;
    let failed = 0;
    const remaining: PendingCallUpload[] = [];
    for (const item of queue) {
      try {
        await cropAdvisorClient.uploadCall(item);
        uploaded += 1;
      } catch {
        failed += 1;
        remaining.push(item);
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    }
    return { uploaded, failed };
  },
};
