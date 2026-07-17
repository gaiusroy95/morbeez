import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { expertCaseOwnershipService } from './expert-case-ownership.service.js';

type QueueBucket = 'my_work' | 'available' | 'at_risk' | 'intervention';

export function scoreExpertCaseQueue(row: {
  priority_tier?: string | null;
  sla_due_at?: string | null;
  queued_at?: string | null;
  requeue_count?: number | null;
  queue_weight?: number | null;
}): number {
  const now = Date.now();
  let score = 0;
  if (row.priority_tier === 'emergency') score += 1000;
  else if (row.priority_tier === 'sla_risk') score += 500;
  else score += 100;

  if (row.sla_due_at) {
    const due = new Date(String(row.sla_due_at)).getTime();
    const minutesLeft = (due - now) / 60_000;
    if (minutesLeft < 0) score += 800;
    else if (minutesLeft < 30) score += 400;
    else if (minutesLeft < 120) score += 200;
  }

  // Anti-starvation: older queue time and requeues raise score.
  if (row.queued_at) {
    const ageHours = (now - new Date(String(row.queued_at)).getTime()) / 3_600_000;
    score += Math.min(200, ageHours * 10);
  }
  score += Math.min(100, Number(row.requeue_count ?? 0) * 25);
  score += Number(row.queue_weight ?? 1) * 10;
  return score;
}

export const expertCaseQueueService = {
  enabled(): boolean {
    return env.ENABLE_EXPERT_CASES === true && env.ENABLE_EXPERT_COPILOT_QUEUE === true;
  },

  async listBuckets(ownerEmail: string): Promise<Record<QueueBucket, Record<string, unknown>[]>> {
    const email = ownerEmail.trim().toLowerCase();
    const riskIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data: open } = await supabase
      .from('expert_cases')
      .select('*')
      .eq('review_flag', 'open')
      .is('merged_into_case_id', null)
      .order('sla_due_at', { ascending: true, nullsFirst: false })
      .limit(200);

    const rows = (open ?? []).map((row) => ({
      ...row,
      queue_score: scoreExpertCaseQueue(row),
    }));

    rows.sort((a, b) => Number(b.queue_score) - Number(a.queue_score));

    const my_work = rows.filter(
      (r) => String(r.owner_email ?? '').toLowerCase() === email && r.assignment_status !== 'intervention_required'
    );
    const intervention = rows.filter((r) => r.assignment_status === 'intervention_required');
    const at_risk = rows.filter(
      (r) =>
        !r.owner_email &&
        r.assignment_status === 'queued' &&
        r.sla_due_at &&
        String(r.sla_due_at) <= riskIso
    );
    const available = rows.filter(
      (r) =>
        !r.owner_email &&
        (r.assignment_status === 'queued' || r.assignment_status === 'offered') &&
        !(r.sla_due_at && String(r.sla_due_at) <= riskIso)
    );

    return { my_work, available, at_risk, intervention };
  },

  async matchExpertsForCase(caseId: string): Promise<
    Array<{ email: string; score: number; generalistFallback: boolean }>
  > {
    const { data: caseRow } = await supabase
      .from('expert_cases')
      .select('id, crop_type, priority, metadata')
      .eq('id', caseId)
      .maybeSingle();
    if (!caseRow) return [];

    const { data: requirements } = await supabase
      .from('expert_queue_requirements')
      .select('*')
      .eq('case_id', caseId);

    const { data: capacityRows } = await supabase
      .from('expert_capacity_state')
      .select('*')
      .eq('availability', 'accepting');

    const results: Array<{ email: string; score: number; generalistFallback: boolean }> = [];
    for (const cap of capacityRows ?? []) {
      if (Number(cap.active_weight) >= Number(cap.max_active_weight)) continue;
      const email = String(cap.employee_email).toLowerCase();
      const { data: specialties } = await supabase
        .from('expert_specialties')
        .select('*')
        .eq('employee_profile_id', cap.employee_profile_id)
        .eq('active', true);

      let score = 10;
      let matchedRequired = 0;
      let requiredCount = 0;
      for (const req of requirements ?? []) {
        if (!req.required) continue;
        requiredCount += 1;
        const hit = (specialties ?? []).find(
          (s) =>
            s.specialty_type === req.specialty_type &&
            String(s.specialty_key).toLowerCase() === String(req.specialty_key).toLowerCase() &&
            Number(s.proficiency) >= Number(req.minimum_proficiency)
        );
        if (hit) {
          matchedRequired += 1;
          score += 50 + Number(hit.proficiency) * 5;
        }
      }

      if (caseRow.crop_type) {
        const cropHit = (specialties ?? []).find(
          (s) =>
            s.specialty_type === 'crop' &&
            String(s.specialty_key).toLowerCase() === String(caseRow.crop_type).toLowerCase()
        );
        if (cropHit) score += 30;
      }

      // Prefer less loaded experts (capacity headroom).
      score += Math.max(0, Number(cap.max_active_weight) - Number(cap.active_weight)) * 5;

      const generalistFallback = requiredCount > 0 && matchedRequired < requiredCount;
      if (generalistFallback) score -= 40;
      results.push({ email, score, generalistFallback });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  },

  async autoAssignBatch(limit = 10): Promise<number> {
    if (!this.enabled() || !env.ENABLE_EXPERT_COPILOT_AUTO_ASSIGN) return 0;

    const { data: queued } = await supabase
      .from('expert_cases')
      .select('id, sla_due_at, priority_tier, queued_at, requeue_count, queue_weight')
      .eq('review_flag', 'open')
      .eq('assignment_status', 'queued')
      .is('owner_email', null)
      .is('merged_into_case_id', null)
      .limit(50);

    const ranked = (queued ?? [])
      .map((r) => ({ ...r, queue_score: scoreExpertCaseQueue(r) }))
      .sort((a, b) => b.queue_score - a.queue_score)
      .slice(0, limit);

    let assigned = 0;
    for (const row of ranked) {
      const matches = await this.matchExpertsForCase(String(row.id));
      const best = matches[0];
      if (!best) {
        await this.markAwaitingCapacity(String(row.id));
        continue;
      }
      try {
        await expertCaseOwnershipService.claim({
          caseId: String(row.id),
          ownerEmail: best.email,
          reason: best.generalistFallback ? 'auto_assign_generalist_fallback' : 'auto_assign',
        });
        if (best.generalistFallback) {
          await supabase.from('staff_notifications').upsert(
            {
              recipient_email: best.email,
              category: 'assignment',
              title: 'Generalist assignment',
              body: `Assigned case ${row.id} without full specialty match — review carefully.`,
              case_id: row.id,
              deep_link: `/case/${row.id}`,
              dedupe_key: `case:${row.id}:generalist:${Date.now()}`,
            },
            { onConflict: 'dedupe_key' }
          );
        }
        assigned += 1;
      } catch (err) {
        logger.warn({ err, caseId: row.id }, 'Auto-assign claim failed');
      }
    }
    return assigned;
  },

  async markAwaitingCapacity(caseId: string): Promise<void> {
    await supabase
      .from('expert_cases')
      .update({
        status: 'awaiting_capacity',
        review_flag: 'awaiting_capacity',
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId)
      .eq('review_flag', 'open');

    await supabase.from('staff_notifications').upsert(
      {
        recipient_email: 'ops@morbeez.internal',
        category: 'capacity',
        title: 'No reviewer capacity',
        body: `Expert case ${caseId} is awaiting capacity.`,
        case_id: caseId,
        deep_link: `/case/${caseId}`,
        dedupe_key: `case:${caseId}:awaiting_capacity`,
      },
      { onConflict: 'dedupe_key' }
    );
  },
};
