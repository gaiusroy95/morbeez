export type FieldActivityBlock = {
  id: string;
  farmer_id: string;
  name: string;
  plot_label: string | null;
  crop_type: string;
  stage: string | null;
  acreage_decimal: number | null;
  planting_date: string | null;
  latitude?: number | null;
  longitude?: number | null;
  farmers?: { name: string | null; phone: string | null; district: string | null };
};

export type FieldActivity = {
  id: string;
  farm_block_id: string | null;
  activity_type: string;
  activity_type_id?: string | null;
  activity_label: string | null;
  applied_at: string;
  dap?: number | null;
  notes: string | null;
  cost_inr: number | null;
  field_activity_types?: {
    id: string;
    activity_name: string;
    category: string;
    icon: string | null;
    color_tag: string | null;
    followup_default_days: number | null;
  } | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  activity_status: 'completed' | 'pending' | 'cancelled';
  created_at: string;
  added_from?: string | null;
  source?: string | null;
};

export type FieldActivityType = {
  id: string;
  activity_name: string;
  category: string;
  crop: string | null;
  icon: string | null;
  color_tag: string | null;
  followup_default_days: number | null;
};

export type FieldActivityForm = {
  activityTypeId: string;
  activityType: string;
  activityLabel: string;
  activityDate: string;
  dap: string;
  notes: string;
  costInr: string;
  followUpRequired: boolean;
  followUpDate: string;
  status: string;
};

export function computeDapFromDates(
  plantingDate?: string | null,
  eventDate?: string | null
): number | null {
  if (!plantingDate || !eventDate) return null;
  const start = new Date(plantingDate);
  const end = new Date(eventDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return diff < 0 ? 0 : diff;
}

export function activityEnumFromCategory(category?: string | null): string {
  const c = String(category ?? '').toLowerCase();
  if (c.includes('nutrition')) return 'fertigation';
  if (c.includes('protection')) return 'spray_applied';
  if (c.includes('observation')) return 'scouting';
  if (c.includes('operations') && c.includes('drench')) return 'drench';
  return 'other';
}

export function iconForActivityType(icon?: string | null): string {
  const key = String(icon ?? '').toLowerCase();
  if (key.includes('spray')) return '💦';
  if (key.includes('droplet')) return '💧';
  if (key.includes('sprout')) return '🌱';
  if (key.includes('eye')) return '👁️';
  if (key.includes('flask')) return '🧪';
  if (key.includes('users')) return '👷';
  if (key.includes('layer')) return '🧺';
  return '📝';
}

export function colorClassForTag(tag?: string | null): string {
  const t = String(tag ?? '').toLowerCase();
  if (t.includes('red')) return 'fa-timeline-card--red';
  if (t.includes('amber') || t.includes('yellow')) return 'fa-timeline-card--amber';
  if (t.includes('blue')) return 'fa-timeline-card--blue';
  if (t.includes('violet') || t.includes('purple')) return 'fa-timeline-card--violet';
  if (t.includes('lime')) return 'fa-timeline-card--lime';
  if (t.includes('slate') || t.includes('gray')) return 'fa-timeline-card--slate';
  return 'fa-timeline-card--emerald';
}

export function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fieldActivityAddedFromLabel(row: FieldActivity): string {
  const from = String(row.added_from ?? row.source ?? '').toLowerCase();
  if (from === 'interaction') return 'Interaction';
  if (from === 'telecaller') return 'Interaction';
  if (from === 'whatsapp') return 'WhatsApp';
  if (from === 'admin' || from === 'direct') return 'Direct Entry';
  return 'Direct Entry';
}

export function followUpDefaultDate(activityDate: string, days: number): string {
  const due = new Date(`${activityDate}T00:00:00.000Z`);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString().slice(0, 10);
}
