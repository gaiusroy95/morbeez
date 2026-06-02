import { getToken } from '../../../lib/api';

export type LeadQueueFilterParams = {
  scope: 'mine' | 'all';
  sort: string;
  search: string;
  stage: string;
  district: string;
  pincode: string;
  language: string;
  crop: string;
  owner: string;
  opportunityLevel: '' | 'high' | 'medium' | 'low';
  pendingTasks: boolean;
  escalationsOnly: boolean;
  smartFilter: string;
};

export function buildLeadQueueSearchParams(
  filters: LeadQueueFilterParams,
  extra?: { leadIds?: string[]; limit?: number }
): URLSearchParams {
  const params = new URLSearchParams({
    scope: filters.scope,
    sort: filters.sort,
    limit: String(extra?.limit ?? 120),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.district.trim() ? { district: filters.district.trim() } : {}),
    ...(filters.pincode.trim() ? { pincode: filters.pincode.trim() } : {}),
    ...(filters.language.trim() ? { language: filters.language.trim() } : {}),
    ...(filters.crop.trim() ? { crop: filters.crop.trim() } : {}),
    ...(filters.owner.trim() ? { owner: filters.owner.trim() } : {}),
    ...(filters.opportunityLevel ? { opportunityLevel: filters.opportunityLevel } : {}),
    ...(filters.pendingTasks ? { pendingTasks: 'true' } : {}),
    ...(filters.escalationsOnly ? { escalations: 'true' } : {}),
    ...(filters.smartFilter && filters.smartFilter !== 'all' ? { smartFilter: filters.smartFilter } : {}),
  });
  if (extra?.leadIds?.length) {
    params.set('leadIds', extra.leadIds.join(','));
  }
  return params;
}

export async function downloadLeadQueueCsv(pathWithQuery: string, filename?: string) {
  const token = getToken();
  const res = await fetch(pathWithQuery, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || res.statusText || 'Export failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
