import { STAFF_API_V1 } from './config';
import { fetchWithCache } from './response-cache';
import { staffApi } from './staff-client';
import type {
  PendingCallUpload,
  TelecallerActionQueueItem,
  TelecallerCallRow,
  TelecallerDashboard,
  TelecallerFollowUpSections,
  TelecallerLeadRow,
  TelecallerNotification,
  TelecallerOperationalLeadRow,
  TelecallerQueueSummary,
  TelecallerTaskRow,
  TelecallerTimelineItem,
  TelecallerWorkspaceSummary,
} from '../types/telecaller';
import type { FarmerInteractionRow } from '../types/interactions';
import { EMPTY_TELECALLER_DASHBOARD } from '../types/telecaller';

const TEL = `${STAFF_API_V1}/os/telecaller`;
const DASHBOARD_TTL_MS = 30_000;
const OFFLINE_QUEUE_KEY = 'telecaller_offline_uploads';

function normalizeDashboard(raw: {
  overview?: Partial<TelecallerDashboard['overview']> | null;
  qc?: Partial<TelecallerDashboard['qc']> | null;
  queueHealth?: TelecallerDashboard['queueHealth'];
  actionQueue?: TelecallerDashboard['actionQueue'];
  todaysTasks?: TelecallerDashboard['todaysTasks'];
  escalations?: number;
}): TelecallerDashboard {
  return {
    overview: { ...EMPTY_TELECALLER_DASHBOARD.overview, ...(raw.overview ?? {}) },
    qc: { ...EMPTY_TELECALLER_DASHBOARD.qc, ...(raw.qc ?? {}) },
    queueHealth: raw.queueHealth,
    actionQueue: raw.actionQueue ?? [],
    todaysTasks: raw.todaysTasks ?? [],
    escalations: raw.escalations ?? 0,
  };
}

export const telecallerClient = {
  async getDashboard(opts?: { force?: boolean }): Promise<TelecallerDashboard> {
    return fetchWithCache(
      'telecaller-dashboard',
      DASHBOARD_TTL_MS,
      async () => {
        try {
          const r = await staffApi<{
            ok: boolean;
            overview?: TelecallerDashboard['overview'];
            qc?: TelecallerDashboard['qc'];
            queueHealth?: TelecallerDashboard['queueHealth'];
            actionQueue?: TelecallerActionQueueItem[];
            todaysTasks?: TelecallerTaskRow[];
            escalations?: number;
          }>(`${TEL}/mobile/dashboard`);
          return normalizeDashboard(r);
        } catch {
          const [overviewRes, qcRes] = await Promise.all([
            staffApi<{ ok: boolean; overview: TelecallerDashboard['overview'] }>(`${TEL}/overview`),
            staffApi<{ ok: boolean; overview: TelecallerDashboard['qc'] }>(`${TEL}/qc/overview?days=7`).catch(
              () => ({ ok: true, overview: EMPTY_TELECALLER_DASHBOARD.qc })
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

  async listLeads(opts?: { scope?: 'mine' | 'all'; limit?: number }): Promise<TelecallerLeadRow[]> {
    const params = new URLSearchParams();
    params.set('scope', opts?.scope ?? 'mine');
    if (opts?.limit) params.set('limit', String(opts.limit));
    const r = await staffApi<{ ok: boolean; leads: TelecallerLeadRow[] }>(
      `${TEL}/mobile/leads?${params}`
    );
    return r.leads ?? [];
  },

  async listOperationalLeads(opts?: {
    scope?: 'mine' | 'all';
    search?: string;
    smartFilter?: string;
    sort?: string;
    limit?: number;
  }): Promise<TelecallerOperationalLeadRow[]> {
    const params = new URLSearchParams();
    params.set('scope', opts?.scope ?? 'mine');
    if (opts?.search) params.set('search', opts.search);
    if (opts?.smartFilter) params.set('smartFilter', opts.smartFilter);
    if (opts?.sort) params.set('sort', opts.sort);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const r = await staffApi<{ ok: boolean; leads: TelecallerOperationalLeadRow[] }>(
      `${TEL}/mobile/leads/operational?${params}`
    );
    return r.leads ?? [];
  },

  async getQueueSummary(scope: 'mine' | 'all' = 'mine'): Promise<TelecallerQueueSummary> {
    const r = await staffApi<{ ok: boolean; summary: TelecallerQueueSummary }>(
      `${TEL}/leads/queue-summary?scope=${scope}`
    );
    return r.summary ?? {};
  },

  async listFollowUps(status = 'pending'): Promise<TelecallerTaskRow[]> {
    const r = await staffApi<{ ok: boolean; tasks: TelecallerTaskRow[] }>(
      `${TEL}/mobile/follow-ups?status=${encodeURIComponent(status)}`
    );
    return r.tasks ?? [];
  },

  async listFollowUpSections(): Promise<TelecallerFollowUpSections> {
    const r = await staffApi<{ ok: boolean; sections: TelecallerFollowUpSections }>(
      `${TEL}/mobile/follow-ups?grouped=true`
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

  async listNotifications(): Promise<TelecallerNotification[]> {
    const r = await staffApi<{ ok: boolean; notifications: TelecallerNotification[] }>(
      `${TEL}/mobile/notifications`
    );
    return r.notifications ?? [];
  },

  async getLeadDetail(leadId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean } & Record<string, unknown>>(`${TEL}/leads/${leadId}`);
    return r;
  },

  async getLeadWorkspaceSummary(leadId: string): Promise<TelecallerWorkspaceSummary> {
    const r = await staffApi<{ ok: boolean; summary: TelecallerWorkspaceSummary }>(
      `${TEL}/mobile/leads/${leadId}/workspace-summary`
    );
    return r.summary;
  },

  async getLeadFarmerProfile(leadId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean } & Record<string, unknown>>(
      `${TEL}/leads/${leadId}/farmer-profile`
    );
    return r;
  },

  async getLeadIntelligence(leadId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; profile: Record<string, unknown> }>(
      `${TEL}/leads/${leadId}/intelligence`
    );
    return r.profile ?? {};
  },

  async listSalesOpportunities(): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; opportunities: Record<string, unknown>[] }>(
      `${TEL}/mobile/sales-opportunities`
    );
    return r.opportunities ?? [];
  },

  async updateSalesOpportunityStatus(id: string, status: string): Promise<void> {
    await staffApi(`${TEL}/sales-opportunities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async getLeadTeamTimeline(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; timeline: Record<string, unknown>[] }>(
      `${TEL}/leads/${leadId}/team-timeline`
    );
    return r.timeline ?? [];
  },

  async addLeadTeamComment(leadId: string, body: string): Promise<void> {
    await staffApi(`${TEL}/leads/${leadId}/team-timeline`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  async getLeadCrmBundle(leadId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean } & Record<string, unknown>>(`${TEL}/leads/${leadId}/crm`);
    return r;
  },

  async listLeadInteractions(
    leadId: string,
    opts?: { limit?: number }
  ): Promise<{ interactions: FarmerInteractionRow[] }> {
    const params = opts?.limit ? `?limit=${opts.limit}` : '';
    const r = await staffApi<{ ok: boolean; interactions: FarmerInteractionRow[] }>(
      `${TEL}/leads/${leadId}/interactions${params}`
    );
    return { interactions: r.interactions ?? [] };
  },

  async getLeadInteractionDetail(
    leadId: string,
    interactionId: string
  ): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; interaction: Record<string, unknown> }>(
      `${TEL}/leads/${leadId}/interactions/${interactionId}`
    );
    return r.interaction ?? {};
  },

  async listLeadBlocks(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; blocks: Record<string, unknown>[] }>(
      `${TEL}/leads/${leadId}/blocks`
    );
    return r.blocks ?? [];
  },

  async getBlockWorkspace(leadId: string, blockId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; workspace: Record<string, unknown> }>(
      `${TEL}/leads/${leadId}/blocks/${blockId}/workspace`
    );
    return r.workspace ?? {};
  },

  async listLeadRecommendations(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; recommendations: Record<string, unknown>[] }>(
      `${TEL}/leads/${leadId}/recommendations`
    );
    return r.recommendations ?? [];
  },

  async listLeadOrders(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; orders: Record<string, unknown>[] }>(
      `${TEL}/leads/${leadId}/orders`
    );
    return r.orders ?? [];
  },

  async getLeadOrder(leadId: string, orderId: string): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; order: Record<string, unknown> }>(
      `${TEL}/leads/${leadId}/orders/${orderId}`
    );
    return r.order ?? {};
  },

  async listLeadNotes(leadId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; notes: Record<string, unknown>[] }>(
      `${TEL}/leads/${leadId}/notes`
    );
    return r.notes ?? [];
  },

  async addLeadNote(leadId: string, note: string): Promise<void> {
    await staffApi(`${TEL}/leads/${leadId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  async createLeadTask(
    leadId: string,
    input: { title: string; dueAt?: string; notes?: string; taskCategory?: string }
  ): Promise<Record<string, unknown>> {
    const r = await staffApi<{ ok: boolean; task: Record<string, unknown> }>(
      `${TEL}/leads/${leadId}/tasks`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    return r.task ?? {};
  },

  async completeTask(taskId: string): Promise<void> {
    await staffApi(`${TEL}/tasks/${taskId}/complete`, { method: 'PATCH' });
  },

  async snoozeTask(taskId: string, dueAt: string): Promise<void> {
    await staffApi(`${TEL}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ dueAt }),
    });
  },

  async listWhatsAppMessages(farmerId: string): Promise<Record<string, unknown>[]> {
    const r = await staffApi<{ ok: boolean; messages: Record<string, unknown>[] }>(
      `${TEL}/whatsapp/${farmerId}/messages`
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
  }): Promise<TelecallerCallRow> {
    const r = await staffApi<{ ok: boolean; call: TelecallerCallRow }>(
      `${TEL}/leads/${input.leadId}/calls/upload`,
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

  async getCall(callId: string): Promise<TelecallerCallRow> {
    const r = await staffApi<{ ok: boolean; call: TelecallerCallRow }>(`${TEL}/calls/${callId}`);
    return r.call;
  },

  async getLeadTimeline(leadId: string): Promise<TelecallerTimelineItem[]> {
    const r = await staffApi<{ ok: boolean; items: TelecallerTimelineItem[] }>(
      `${TEL}/leads/${leadId}/timeline`
    );
    return r.items ?? [];
  },

  async clickToCall(leadId: string, farmerPhone: string): Promise<{ callLogId: string }> {
    const r = await staffApi<{ ok: boolean; callLogId: string }>(`${TEL}/exotel/click-to-call`, {
      method: 'POST',
      body: JSON.stringify({ leadId, farmerPhone }),
    });
    return { callLogId: r.callLogId };
  },

  async queueOfflineUpload(item: Omit<PendingCallUpload, 'id' | 'createdAt'>): Promise<void> {
    const existing = await telecallerClient.listOfflineQueue();
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
    const queue = await telecallerClient.listOfflineQueue();
    if (!queue.length) return { uploaded: 0, failed: 0 };
    let uploaded = 0;
    let failed = 0;
    const remaining: PendingCallUpload[] = [];
    for (const item of queue) {
      try {
        await telecallerClient.uploadCall(item);
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
