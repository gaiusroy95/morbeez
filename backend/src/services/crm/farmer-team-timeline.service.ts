import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { partnerTimelineService } from '../partner/partner-timeline.service.js';

export type TeamTimelineEntry = {
  id: string;
  source: 'timeline' | 'task' | 'visit' | 'escalation' | 'call';
  title: string;
  body: string;
  authorType: string;
  authorName: string | null;
  at: string;
  taskId?: string;
  fieldFindingId?: string;
  metadata?: Record<string, unknown>;
};

export const farmerTeamTimelineService = {
  async addSystemEntry(input: {
    farmerId: string;
    body: string;
    title?: string;
    entryType?: 'note' | 'comment' | 'escalation' | 'support_request' | 'review_request' | 'system_event';
    taskId?: string;
    fieldFindingId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return partnerTimelineService.addEntry({
      farmerId: input.farmerId,
      body: input.title ? `${input.title}: ${input.body}` : input.body,
      authorType: 'system',
      authorName: 'Morbeez',
      entryType: input.entryType ?? 'system_event',
      taskId: input.taskId,
      fieldFindingId: input.fieldFindingId,
      metadata: input.metadata,
    });
  },

  async listForFarmer(farmerId: string, limit = 60): Promise<TeamTimelineEntry[]> {
    const entries: TeamTimelineEntry[] = [];

    const [timelineRes, tasksRes, visitsRes, escalationsRes] = await Promise.all([
      partnerTimelineService.listForFarmer(farmerId, limit),
      supabase
        .from('crm_tasks')
        .select('id, title, status, task_type, assigned_to, assigned_partner_id, due_at, updated_at, created_at')
        .eq('farmer_id', farmerId)
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase
        .from('crm_field_findings')
        .select('id, summary, visited_at, created_at, submitted_by_role, partner_id')
        .eq('farmer_id', farmerId)
        .is('archived_at', null)
        .order('visited_at', { ascending: false })
        .limit(15),
      supabase
        .from('agronomist_escalations')
        .select('id, title, status, created_at, updated_at')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    throwIfSupabaseError(tasksRes.error, 'Could not load task timeline');
    throwIfSupabaseError(visitsRes.error, 'Could not load visit timeline');
    throwIfSupabaseError(escalationsRes.error, 'Could not load escalation timeline');

    for (const row of timelineRes) {
      entries.push({
        id: String(row.id),
        source: 'timeline',
        title: String(row.entry_type ?? 'Note'),
        body: String(row.body ?? ''),
        authorType: String(row.author_type ?? 'system'),
        authorName: row.author_name ? String(row.author_name) : null,
        at: String(row.created_at),
        taskId: row.task_id ? String(row.task_id) : undefined,
        fieldFindingId: row.field_finding_id ? String(row.field_finding_id) : undefined,
      });
    }

    for (const t of tasksRes.data ?? []) {
      entries.push({
        id: `task-${t.id}`,
        source: 'task',
        title: `Task: ${String(t.title ?? 'Task')}`,
        body: `Status ${String(t.status)} · ${String(t.task_type ?? '')}`,
        authorType: t.assigned_partner_id ? 'partner' : 'telecaller',
        authorName: null,
        at: String(t.updated_at ?? t.created_at),
        taskId: String(t.id),
      });
    }

    for (const v of visitsRes.data ?? []) {
      entries.push({
        id: `visit-${v.id}`,
        source: 'visit',
        title: 'Field visit',
        body: String(v.summary ?? 'Visit recorded'),
        authorType: String(v.submitted_by_role ?? 'agronomist'),
        authorName: null,
        at: String(v.visited_at ?? v.created_at),
        fieldFindingId: String(v.id),
      });
    }

    for (const e of escalationsRes.data ?? []) {
      entries.push({
        id: `escalation-${e.id}`,
        source: 'escalation',
        title: String(e.title ?? 'Escalation'),
        body: `Status ${String(e.status)}`,
        authorType: 'expert',
        authorName: null,
        at: String(e.updated_at ?? e.created_at),
      });
    }

    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return entries.slice(0, limit);
  },

  async addComment(input: {
    farmerId: string;
    body: string;
    authorType: 'telecaller' | 'partner' | 'expert' | 'admin';
    authorEmail?: string;
    authorName?: string;
    partnerId?: string;
    entryType?: 'note' | 'comment' | 'support_request';
  }) {
    return partnerTimelineService.addEntry({
      farmerId: input.farmerId,
      body: input.body,
      authorType: input.authorType,
      authorEmail: input.authorEmail,
      authorName: input.authorName,
      partnerId: input.partnerId,
      entryType: input.entryType ?? 'comment',
    });
  },
};
