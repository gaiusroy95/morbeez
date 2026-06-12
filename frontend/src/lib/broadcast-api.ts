import { api } from './api';

export const BROADCAST_API = '/morbeez-staff/api/v1/os/broadcasts';
export const OPERATIONS_API = '/morbeez-staff/api/v1/os/operations';

export type BroadcastAudience = {
  cropTypes?: string[];
  districts?: string[];
  languages?: string[];
  broadcastTags?: string[];
  farmerCategories?: string[];
};

export type BroadcastCampaign = {
  id: string;
  name: string;
  category: string;
  status: string;
  audienceJson: BroadcastAudience;
  messageTitle: string | null;
  messageBody: string;
  languageMode: string;
  mediaUrls: string[];
  templateId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  statsJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BroadcastTemplate = {
  id: string;
  name: string;
  category: string;
  cropType: string | null;
  targetDap: number | null;
  title: string | null;
  body: string;
  language: string;
  mediaUrls: string[];
  status: string;
  version: number;
  createdBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BroadcastDelivery = {
  id: string;
  broadcast_kind: string;
  status: string;
  skip_reason?: string | null;
  created_at: string;
  campaign_id?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  farmers?: { phone: string; name: string | null; district: string | null };
};

export const CAMPAIGN_CATEGORIES = [
  { value: 'cultivation_advisory', label: 'Cultivation advisory' },
  { value: 'fertigation_reminder', label: 'Fertigation reminder' },
  { value: 'pest_disease_alert', label: 'Pest / disease alert' },
  { value: 'weather_alert', label: 'Weather alert' },
  { value: 'market_price_update', label: 'Market price update' },
  { value: 'custom_message', label: 'Custom message' },
] as const;

export const VARIABLE_CHIPS = [
  '{{FarmerName}}',
  '{{Crop}}',
  '{{DAP}}',
  '{{Village}}',
  '{{FarmArea}}',
  '{{District}}',
] as const;

export async function fetchBroadcastDashboard() {
  return api<{
    ok: boolean;
    recentCampaigns: BroadcastCampaign[];
    approvedTemplates: BroadcastTemplate[];
    scheduledCampaigns: BroadcastCampaign[];
  }>(`${BROADCAST_API}/dashboard`);
}

export async function fetchBroadcastAnalytics(days = 30) {
  return api<{
    ok: boolean;
    analytics: {
      totals: { sent: number; failed: number; skipped: number };
    };
  }>(`${BROADCAST_API}/analytics?days=${days}`);
}

export async function fetchBroadcastRules() {
  return api<{ ok: boolean; rules: BroadcastRule[] }>(`${OPERATIONS_API}/broadcasts/rules`);
}

export type BroadcastRule = {
  id: string;
  crop_type: string;
  broadcast_kind: string;
  target_dap: number | null;
  min_dap: number | null;
  max_dap: number | null;
  weekday: number | null;
  dap_tolerance?: number;
  priority: number;
  active: boolean;
};

export async function previewAudience(audienceJson: BroadcastAudience) {
  return api<{ ok: boolean; count: number; sample: unknown[] }>(`${BROADCAST_API}/audience/preview`, {
    method: 'POST',
    body: JSON.stringify({ audienceJson }),
  });
}
