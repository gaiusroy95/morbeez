import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { telecallerAdminService } from '../admin/telecaller-admin.service.js';
import { agronomistMobileService } from './agronomist-mobile.service.js';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export type VisitCommandCenterRow = {
  id: string;
  farmerId: string;
  farmerName: string;
  blockName: string | null;
  cropName: string | null;
  priority: 'normal' | 'urgent' | 'emergency';
  status: string;
  visitedAt: string | null;
  dueAt: string | null;
  issueSummary: string | null;
  monitoringRecovery?: {
    d3: string | null;
    d7: string | null;
    d14: string | null;
  };
};

const RECOVERY_JOB_TYPES = [
  'maios_recovery_d3',
  'maios_recovery_d7',
  'maios_recovery_d14',
  'ginger_sop_recovery_d3',
  'ginger_sop_recovery_d7',
  'ginger_sop_recovery_d14',
] as const;

function recoveryDayFromJobType(jobType: string): 3 | 7 | 14 | null {
  const match = jobType.match(/_d(\d+)$/);
  const day = match ? Number(match[1]) : 0;
  if (day === 3 || day === 7 || day === 14) return day;
  return null;
}

async function loadMonitoringRecoveryByFarmer(
  farmerIds: string[]
): Promise<Map<string, { d3: string | null; d7: string | null; d14: string | null }>> {
  const map = new Map<string, { d3: string | null; d7: string | null; d14: string | null }>();
  if (!farmerIds.length) return map;

  const { data } = await supabase
    .from('advisory_automation_jobs')
    .select('farmer_id, job_type, status, scheduled_at, completed_at')
    .in('farmer_id', farmerIds)
    .in('job_type', [...RECOVERY_JOB_TYPES])
    .order('scheduled_at', { ascending: false })
    .limit(500);

  for (const farmerId of farmerIds) {
    map.set(farmerId, { d3: null, d7: null, d14: null });
  }

  for (const row of data ?? []) {
    const farmerId = String(row.farmer_id);
    const bucket = map.get(farmerId);
    if (!bucket) continue;
    const day = recoveryDayFromJobType(String(row.job_type));
    if (!day) continue;
    const key = day === 3 ? 'd3' : day === 7 ? 'd7' : 'd14';
    if (bucket[key]) continue;
    const status = String(row.status);
    const label = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending';
    bucket[key] = label;
  }

  return map;
}

const PRIORITIES = ['normal', 'urgent', 'emergency'] as const;

export const visitCommandCenterService = {
  async updatePriority(findingId: string, priority: (typeof PRIORITIES)[number]) {
    const { data, error } = await supabase
      .from('crm_field_findings')
      .update({ visit_priority: priority })
      .eq('id', findingId)
      .select('id, visit_priority')
      .single();
    throwIfSupabaseError(error, 'Could not update visit priority');
    return { id: String(data!.id), priority: String(data!.visit_priority) as (typeof PRIORITIES)[number] };
  },

  async getCommandCenter(agentEmail: string) {
    const email = agentEmail.trim().toLowerCase();

    const [dashboard, scheduledVisits, priorityFindings, openFindings, escalationCount] =
      await Promise.all([
        agronomistMobileService.getMobileDashboard(email),
        telecallerAdminService.listScheduledVisitsForAgronomist(email),
        supabase
          .from('crm_field_findings')
          .select(
            `id, farmer_id, visited_at, visit_priority, disease_pest, severity, observations,
             farmers(name, first_name, last_name),
             farm_blocks(name, crop_type)`
          )
          .eq('agronomist_name', email)
          .in('visit_priority', ['urgent', 'emergency'])
          .is('archived_at', null)
          .order('visited_at', { ascending: false })
          .limit(30),
        supabase
          .from('crm_field_findings')
          .select('id', { count: 'exact', head: true })
          .eq('agronomist_name', email)
          .is('archived_at', null),
        supabase
          .from('agronomist_escalations')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'assigned', 'in_review']),
      ]);

    throwIfSupabaseError(priorityFindings.error, 'Could not load priority visits');

    const farmerIds = [...new Set((priorityFindings.data ?? []).map((r) => String(r.farmer_id)))];
    const recoveryByFarmer = await loadMonitoringRecoveryByFarmer(farmerIds);

    const priorityQueue: VisitCommandCenterRow[] = (priorityFindings.data ?? []).map((row) => {
      const farmerRaw = row.farmers as unknown;
      const blockRaw = row.farm_blocks as unknown;
      const farmer = (Array.isArray(farmerRaw) ? farmerRaw[0] : farmerRaw) as Record<string, unknown> | null;
      const block = (Array.isArray(blockRaw) ? blockRaw[0] : blockRaw) as Record<string, unknown> | null;
      const name =
        [farmer?.first_name, farmer?.last_name].filter(Boolean).join(' ') ||
        String(farmer?.name ?? 'Farmer');
      return {
        id: String(row.id),
        farmerId: String(row.farmer_id),
        farmerName: name,
        blockName: block?.name ? String(block.name) : null,
        cropName: block?.crop_type ? String(block.crop_type) : null,
        priority: (row.visit_priority ?? 'normal') as VisitCommandCenterRow['priority'],
        status: 'field_finding',
        visitedAt: row.visited_at ? String(row.visited_at) : null,
        dueAt: null,
        issueSummary: row.observations
          ? String(row.observations).slice(0, 120)
          : String(row.disease_pest ?? ''),
        monitoringRecovery: recoveryByFarmer.get(String(row.farmer_id)),
      };
    });

    const todaysVisits = scheduledVisits.filter((v) => {
      const due = String(v.dueLabel ?? '');
      return due.includes(todayIsoDate()) || due.toLowerCase().includes('today');
    });

    return {
      summary: {
        todaysVisits: dashboard.todaysVisits ?? todaysVisits.length,
        openIssues: openFindings.count ?? 0,
        priorityCount: priorityQueue.length,
        openEscalations: escalationCount.count ?? dashboard.openEscalations ?? 0,
        pendingFollowUps: dashboard.pendingFollowUps ?? 0,
        aiReviewCases: dashboard.aiReviewCases ?? 0,
      },
      todaysVisits,
      priorityQueue,
      scheduledVisits,
    };
  },
};
