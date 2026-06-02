import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { crmFarmerService } from './crm-farmer.service.js';

function formatDt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string | null | undefined): string {
  const full = formatDt(iso);
  if (!full) return '—';
  return full.split(',')[0] ?? full;
}

type ActivityTone = 'success' | 'info' | 'purple' | 'warning' | 'review';

export const telecallerFarmerAgronomistService = {
  async getPanel(farmerId: string) {
    const agronomist = await crmFarmerService.getAgronomist(farmerId);

    const [findingsRes, recsRes, findingsCount, recsCount, pendingFollowUps] = await Promise.all([
      supabase
        .from('crm_field_findings')
        .select('id, visited_at, block_name, observations, disease_pest, action_taken, agronomist_name')
        .eq('farmer_id', farmerId)
        .is('archived_at', null)
        .order('visited_at', { ascending: false })
        .limit(30),
      supabase
        .from('crm_recommendations')
        .select('id, created_at, block_id, recommendation, problem, status, farm_blocks(name)')
        .eq('farmer_id', farmerId)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('crm_field_findings')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .is('archived_at', null),
      supabase
        .from('crm_recommendations')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .neq('status', 'archived'),
      supabase
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .eq('status', 'pending')
        .eq('task_type', 'follow_up'),
    ]);

    throwIfSupabaseError(findingsRes.error, 'Could not load activities');
    throwIfSupabaseError(recsRes.error, 'Could not load activities');

    type ActivityRow = {
      id: string;
      source: 'field_finding' | 'recommendation';
      at: string;
      dateLabel: string;
      activity: string;
      activityTone: ActivityTone;
      block: string;
      notes: string;
    };

    const activities: ActivityRow[] = [];

    for (const f of findingsRes.data ?? []) {
      const disease = String(f.disease_pest ?? '');
      let activity = 'Field visit';
      let tone: ActivityTone = 'success';
      if (/soil/i.test(disease) || /soil/i.test(String(f.observations ?? ''))) {
        activity = 'Soil review';
        tone = 'purple';
      } else if (disease && !/healthy/i.test(disease)) {
        activity = 'Disease inspection';
        tone = 'warning';
      }
      activities.push({
        id: String(f.id),
        source: 'field_finding',
        at: String(f.visited_at),
        dateLabel: formatDateOnly(f.visited_at as string),
        activity,
        activityTone: tone,
        block: String(f.block_name ?? '—'),
        notes: String(f.observations ?? f.action_taken ?? disease).slice(0, 200),
      });
    }

    for (const r of recsRes.data ?? []) {
      const block = r.farm_blocks as { name?: string } | null;
      activities.push({
        id: String(r.id),
        source: 'recommendation',
        at: String(r.created_at),
        dateLabel: formatDateOnly(r.created_at as string),
        activity: 'Recommendation shared',
        activityTone: 'info',
        block: block?.name ?? '—',
        notes: String(r.recommendation ?? r.problem ?? '').slice(0, 200),
      });
    }

    activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const visitCount = findingsCount.count ?? 0;
    const recCount = recsCount.count ?? 0;
    const followUpCount = pendingFollowUps.count ?? 0;
    const recoveryPct =
      visitCount > 0 ? Math.min(100, Math.round((recCount / Math.max(visitCount, 1)) * 100)) : 0;

    return {
      agronomist: {
        name: String(agronomist.name ?? '—'),
        employeeId: String(agronomist.employeeId ?? '—'),
        mobile: String(agronomist.mobile ?? ''),
        email: String(agronomist.email ?? ''),
        specialization: String(agronomist.specialization ?? '—'),
        assignedSince: String(agronomist.assignedSince ?? '—'),
        assignedBlocks: String(agronomist.assignedBlocks ?? '—'),
        lastReview: agronomist.lastReview ?? '—',
        nextVisit: agronomist.nextVisit ?? '—',
        status: 'Active',
        statusTone: 'success',
        initials: String(agronomist.name ?? 'A')
          .split(/\s+/)
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
      },
      activities,
      blocks: agronomist.blocks ?? [],
      performance: [
        { label: 'Total visits', value: String(visitCount), icon: '📅' },
        { label: 'Recommendations given', value: String(recCount), icon: '📋' },
        { label: 'Active follow-ups', value: String(followUpCount), icon: '✓' },
        { label: 'Recovery success rate', value: `${recoveryPct}%`, icon: '📈' },
      ],
    };
  },
};
