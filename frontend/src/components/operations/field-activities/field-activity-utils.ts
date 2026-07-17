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
  source_type?: string | null;
  sourceType?: string | null;
  source_message_id?: string | null;
  sourceMessageId?: string | null;
  source_message?: string | null;
  sourceMessage?: string | null;
  transcript?: string | null;
  source_transcript?: string | null;
  language?: string | null;
  source_language?: string | null;
  extraction_confidence?: number | null;
  extractionConfidence?: number | null;
  extraction_warnings?: string[] | null;
  extractionWarnings?: string[] | null;
  original_values?: Record<string, unknown> | null;
  originalValues?: Record<string, unknown> | null;
  confirmed_values?: Record<string, unknown> | null;
  confirmedValues?: Record<string, unknown> | null;
  confirmed_by?: string | null;
  confirmedBy?: string | null;
  confirmed_at?: string | null;
  confirmedAt?: string | null;
  correction_reason?: string | null;
  correctionReason?: string | null;
  roi_entry_id?: string | null;
  roiEntryId?: string | null;
  season_id?: string | null;
  seasonId?: string | null;
  season?: { id?: string; name?: string | null; season_name?: string | null } | null;
  audit_events?: FieldActivityAuditEvent[] | null;
  auditEvents?: FieldActivityAuditEvent[] | null;
};

export type FieldActivityAuditEvent = {
  id?: string;
  action?: string | null;
  event?: string | null;
  actor?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  details?: string | Record<string, unknown> | null;
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
  if (isConfirmedVoiceActivity(row)) return 'Voice-derived';
  const from = String(row.added_from ?? row.source_type ?? row.sourceType ?? row.source ?? '').toLowerCase();
  if (from.includes('voice') || from.includes('audio')) return 'Voice-derived';
  if (from === 'interaction') return 'Interaction';
  if (from === 'telecaller') return 'Interaction';
  if (from === 'whatsapp') return 'WhatsApp';
  if (from === 'admin' || from === 'direct') return 'Direct Entry';
  return 'Direct Entry';
}

export function isConfirmedVoiceActivity(row: FieldActivity): boolean {
  const source = String(
    row.source_type ?? row.sourceType ?? row.added_from ?? row.source ?? ''
  ).toLowerCase();
  const hasVoiceSource =
    source.includes('voice') ||
    source.includes('audio') ||
    Boolean(row.transcript ?? row.source_transcript);
  const isConfirmed = Boolean(row.confirmed_at ?? row.confirmedAt ?? row.confirmed_by ?? row.confirmedBy);
  return hasVoiceSource && isConfirmed;
}

export function formFromFieldActivity(row: FieldActivity): FieldActivityForm {
  return {
    activityTypeId: row.activity_type_id ?? row.field_activity_types?.id ?? '',
    activityType: row.activity_type,
    activityLabel: row.activity_label?.trim() || row.field_activity_types?.activity_name || '',
    activityDate: String(row.applied_at).slice(0, 10),
    dap: row.dap != null ? String(row.dap) : '',
    notes: row.notes ?? '',
    costInr: row.cost_inr != null ? String(row.cost_inr) : '',
    followUpRequired: Boolean(row.follow_up_required),
    followUpDate: row.follow_up_date ? String(row.follow_up_date).slice(0, 10) : '',
    status: row.activity_status,
  };
}

export function followUpDefaultDate(activityDate: string, days: number): string {
  const due = new Date(`${activityDate}T00:00:00.000Z`);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString().slice(0, 10);
}
