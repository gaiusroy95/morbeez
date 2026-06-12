import { STAFF_API_V1 } from './config';
import { fetchWithCache } from './response-cache';
import { staffApi } from './staff-client';
import type {
  PendingCallUpload,
  TelecallerCallRow,
  TelecallerDashboard,
  TelecallerLeadRow,
  TelecallerTaskRow,
  TelecallerTimelineItem,
} from '../types/telecaller';
import { EMPTY_TELECALLER_DASHBOARD } from '../types/telecaller';

const TEL = `${STAFF_API_V1}/os/telecaller`;
const DASHBOARD_TTL_MS = 30_000;
const OFFLINE_QUEUE_KEY = 'telecaller_offline_uploads';

function normalizeDashboard(raw: {
  overview?: Partial<TelecallerDashboard['overview']> | null;
  qc?: Partial<TelecallerDashboard['qc']> | null;
  queueHealth?: TelecallerDashboard['queueHealth'];
}): TelecallerDashboard {
  return {
    overview: { ...EMPTY_TELECALLER_DASHBOARD.overview, ...(raw.overview ?? {}) },
    qc: { ...EMPTY_TELECALLER_DASHBOARD.qc, ...(raw.qc ?? {}) },
    queueHealth: raw.queueHealth,
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

  async listFollowUps(status = 'pending'): Promise<TelecallerTaskRow[]> {
    const r = await staffApi<{ ok: boolean; tasks: TelecallerTaskRow[] }>(
      `${TEL}/mobile/follow-ups?status=${encodeURIComponent(status)}`
    );
    return r.tasks ?? [];
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

  /** Persist failed uploads for retry when back online (mobile). */
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
