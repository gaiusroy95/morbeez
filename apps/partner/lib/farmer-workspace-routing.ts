export type PartnerWorkspaceTab =
  | 'overview'
  | 'interactions'
  | 'blocks'
  | 'tasks'
  | 'visits'
  | 'orders'
  | 'escalations'
  | 'collaboration'
  | 'sales';

export const PARTNER_WORKSPACE_TABS: Array<{ id: PartnerWorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'interactions', label: 'Interactions' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'visits', label: 'Visits' },
  { id: 'orders', label: 'Orders' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'sales', label: 'Sales' },
];

export function suggestedActionLabel(action: string): string {
  const labels: Record<string, string> = {
    field_visit: 'Field visit',
    follow_up: 'Follow-up',
    soil_sampling: 'Soil sampling',
    callback: 'Schedule callback',
    none: '—',
  };
  return labels[action] ?? action;
}

export function openDirections(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
