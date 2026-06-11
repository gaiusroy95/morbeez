import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { fieldPwaService } from '../admin/field-pwa.service.js';
import { blockService } from '../core/block.service.js';
import { agronomistIntelligenceService } from '../intelligence/agronomist-intelligence.service.js';
import { agronomistCaseReviewService } from '../admin/agronomist-case-review.service.js';
import { agronomistWorkflowService } from '../admin/agronomist-workflow.service.js';
import { recommendationFollowUpService } from '../core/recommendation-follow-up.service.js';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolveLeadId(farmerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('leads')
    .select('id')
    .eq('farmer_id', farmerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

type FarmerJoinRow = {
  id?: string;
  phone?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  district?: string;
  village?: string;
  preferred_language?: string;
};

function mapFarmerFromJoin(farmerId: string, f: FarmerJoinRow | null) {
  return {
    id: farmerId,
    phone: f?.phone ? String(f.phone) : null,
    name:
      [f?.first_name, f?.last_name].filter(Boolean).join(' ') ||
      String(f?.name ?? '').trim() ||
      'Farmer',
    district: f?.district ? String(f.district) : null,
    village: f?.village ? String(f.village) : null,
    preferredLanguage: f?.preferred_language ? String(f.preferred_language) : 'en',
  };
}

function farmersFromRelationRows(
  rows: Array<{ farmer_id: string | number; farmers: FarmerJoinRow | FarmerJoinRow[] | null }>,
  limit: number
) {
  const seen = new Set<string>();
  const farmers: ReturnType<typeof mapFarmerFromJoin>[] = [];
  for (const row of rows) {
    const fid = String(row.farmer_id);
    if (seen.has(fid)) continue;
    seen.add(fid);
    const joined = Array.isArray(row.farmers) ? row.farmers[0] : row.farmers;
    farmers.push(mapFarmerFromJoin(fid, joined ?? null));
    if (farmers.length >= limit) break;
  }
  return farmers;
}

export const agronomistMobileService = {
  async getMobileDashboard(agentEmail: string) {
    const email = agentEmail.trim().toLowerCase();
    const todayStart = `${todayIsoDate()}T00:00:00.000Z`;
    const todayEnd = `${todayIsoDate()}T23:59:59.999Z`;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      intelligence,
      visitsToday,
      followUps,
      callbacks,
      escalations,
      soilReports,
      aiCases,
      findingQueue,
      routesToday,
    ] = await Promise.all([
      agronomistIntelligenceService.getWorkspaceIntelligence(email),
      supabase
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('task_type', 'visit')
        .eq('assigned_to', email)
        .gte('due_at', todayStart)
        .lte('due_at', todayEnd)
        .in('status', ['pending', 'open', 'in_progress']),
      supabase
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', email)
        .in('task_type', ['follow_up', 'call', 'other'])
        .lte('due_at', todayEnd)
        .in('status', ['pending', 'open', 'in_progress']),
      supabase
        .from('callback_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'open', 'requested']),
      supabase
        .from('agronomist_escalations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'assigned', 'in_review']),
      supabase
        .from('crm_soil_reports')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo),
      agronomistCaseReviewService.listQueue({ status: 'open', page: 1, limit: 1 }),
      agronomistWorkflowService.listReviewQueue(1),
      supabase
        .from('agronomist_routes')
        .select('id', { count: 'exact', head: true })
        .eq('agronomist_email', email)
        .eq('route_date', todayIsoDate()),
    ]);

    return {
      todaysVisits: visitsToday.count ?? 0,
      routesToday: routesToday.count ?? 0,
      pendingFollowUps: followUps.count ?? 0,
      pendingCallbacks: callbacks.count ?? 0,
      openEscalations: escalations.count ?? 0,
      newSoilReports: soilReports.count ?? 0,
      aiReviewCases: aiCases.total ?? 0,
      findingReviewQueue: (findingQueue.items ?? []).length,
      focusFarmers: intelligence.focusFarmers,
    };
  },

  async listMobileFarmers(
    agentEmail: string,
    opts: {
      q?: string;
      filter?: string;
      lat?: number;
      lng?: number;
      limit?: number;
    }
  ) {
    const email = agentEmail.trim().toLowerCase();
    const limit = opts.limit ?? 40;
    let farmers = opts.q?.trim()
      ? await fieldPwaService.searchFarmers(opts.q, limit)
      : [];

    if (!opts.q?.trim() && opts.filter === 'assigned') {
      const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('crm_field_findings')
        .select('farmer_id, farmers(id, phone, name, first_name, last_name, district, village, preferred_language)')
        .eq('agronomist_name', email)
        .gte('visited_at', since90)
        .is('archived_at', null)
        .order('visited_at', { ascending: false })
        .limit(limit);
      throwIfSupabaseError(error, 'Could not load assigned farmers');
      farmers = farmersFromRelationRows(data ?? [], limit);
    }

    if (!farmers.length && !opts.q?.trim() && opts.filter === 'follow_up_due') {
      const todayEnd = `${todayIsoDate()}T23:59:59.999Z`;
      const { data, error } = await supabase
        .from('crm_tasks')
        .select('farmer_id, farmers(id, phone, name, first_name, last_name, district, village, preferred_language)')
        .eq('assigned_to', email)
        .in('task_type', ['follow_up', 'call', 'other'])
        .lte('due_at', todayEnd)
        .in('status', ['pending', 'open', 'in_progress'])
        .not('farmer_id', 'is', null)
        .order('due_at', { ascending: true })
        .limit(limit);
      throwIfSupabaseError(error, 'Could not load follow-up farmers');
      farmers = farmersFromRelationRows(data ?? [], limit);
    }

    if (!farmers.length && !opts.q?.trim() && opts.filter === 'escalation_open') {
      const { data, error } = await supabase
        .from('agronomist_escalations')
        .select('farmer_id, farmers(id, phone, name, first_name, last_name, district, village, preferred_language)')
        .in('status', ['pending', 'assigned', 'in_review'])
        .not('farmer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      throwIfSupabaseError(error, 'Could not load escalation farmers');
      farmers = farmersFromRelationRows(data ?? [], limit);
    }

    if (!farmers.length && !opts.q?.trim()) {
      farmers = await fieldPwaService.listRecentFarmers(limit);
    }

    const enriched = await Promise.all(
      farmers.map(async (f) => {
        const blocks = await blockService.listByFarmer(f.id);
        const primary = blocks[0];
        let distanceKm: number | null = null;
        if (opts.lat != null && opts.lng != null && primary?.latitude != null && primary?.longitude != null) {
          distanceKm = Math.round(haversineKm(opts.lat, opts.lng, primary.latitude, primary.longitude) * 10) / 10;
        }

        const { data: lastVisit } = await supabase
          .from('crm_field_findings')
          .select('visited_at')
          .eq('farmer_id', f.id)
          .is('archived_at', null)
          .order('visited_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: openTasks } = await supabase
          .from('crm_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('farmer_id', f.id)
          .in('status', ['pending', 'open', 'in_progress']);

        return {
          ...f,
          acreage: blocks.reduce((s, b) => s + (b.acreage_decimal ?? 0), 0) || null,
          primaryCrop: primary?.crop_type ?? null,
          dap: primary?.dap ?? null,
          distanceKm,
          healthStatus: 'stable',
          lastVisitAt: lastVisit?.visited_at ? String(lastVisit.visited_at) : null,
          openTaskCount: openTasks ?? 0,
        };
      })
    );

    let rows = enriched;
    if (opts.filter === 'recently_visited') {
      rows = rows.filter((r) => r.lastVisitAt).sort((a, b) => String(b.lastVisitAt).localeCompare(String(a.lastVisitAt)));
    }
    if (opts.lat != null && opts.lng != null) {
      rows.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }
    return rows.slice(0, limit);
  },

  async getWorkspaceSummary(farmerId: string) {
    const { data: farmer, error } = await supabase
      .from('farmers')
      .select('id, phone, name, first_name, last_name, district, total_acres')
      .eq('id', farmerId)
      .single();
    throwIfSupabaseError(error, 'Farmer not found');
    if (!farmer) throw new NotFoundError('Farmer not found');

    const blocks = await blockService.listByFarmer(farmerId);
    const leadId = await resolveLeadId(farmerId);

    const { data: lastVisit } = await supabase
      .from('crm_field_findings')
      .select('visited_at')
      .eq('farmer_id', farmerId)
      .is('archived_at', null)
      .order('visited_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: pendingTasks } = await supabase
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('farmer_id', farmerId)
      .in('status', ['pending', 'open', 'in_progress']);

    const { count: openEscalations } = await supabase
      .from('agronomist_escalations')
      .select('id', { count: 'exact', head: true })
      .eq('farmer_id', farmerId)
      .in('status', ['pending', 'assigned', 'in_review']);

    const name =
      [farmer.first_name, farmer.last_name].filter(Boolean).join(' ') ||
      String(farmer.name ?? '').trim() ||
      'Farmer';

    return {
      farmer: {
        id: farmerId,
        name,
        phone: farmer.phone ? String(farmer.phone) : null,
        district: farmer.district ? String(farmer.district) : null,
        acreage: farmer.total_acres != null ? Number(farmer.total_acres) : null,
      },
      leadId,
      healthStatus: openEscalations ? 'alert' : 'stable',
      activeCrops: [...new Set(blocks.map((b) => b.crop_type).filter(Boolean))],
      dap: blocks[0]?.dap ?? null,
      lastVisitAt: lastVisit?.visited_at ? String(lastVisit.visited_at) : null,
      pendingTaskCount: pendingTasks ?? 0,
      openEscalationCount: openEscalations ?? 0,
    };
  },

  async listFarmerDocuments(farmerId: string) {
    const docs: Array<{ id: string; type: string; title: string; url: string | null; createdAt: string }> = [];

    const { data: soil } = await supabase
      .from('crm_soil_reports')
      .select('id, report_type, report_url, created_at, block_name')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(30);
    for (const r of soil ?? []) {
      docs.push({
        id: String(r.id),
        type: 'soil_report',
        title: `${r.report_type ?? 'Soil'} — ${r.block_name ?? 'Block'}`,
        url: r.report_url ? String(r.report_url) : null,
        createdAt: String(r.created_at),
      });
    }

    const { data: recs } = await supabase
      .from('recommendation_records')
      .select('id, issue_detected, created_at, status')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(20);
    for (const r of recs ?? []) {
      docs.push({
        id: String(r.id),
        type: 'recommendation',
        title: String(r.issue_detected ?? 'Recommendation'),
        url: null,
        createdAt: String(r.created_at),
      });
    }

    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listUnifiedTasks(agentEmail: string, filter?: string) {
    const email = agentEmail.trim().toLowerCase();
    const todayEnd = `${todayIsoDate()}T23:59:59.999Z`;
    const tasks: Array<{
      id: string;
      kind: string;
      title: string;
      subtitle: string;
      dueAt: string | null;
      status: string;
      farmerId?: string | null;
      leadId?: string | null;
      refId?: string;
    }> = [];

    if (!filter || filter === 'visit' || filter === 'all') {
      const { data } = await supabase
        .from('crm_tasks')
        .select('id, title, task_type, due_at, status, farmer_id, lead_id')
        .eq('assigned_to', email)
        .eq('task_type', 'visit')
        .lte('due_at', todayEnd)
        .in('status', ['pending', 'open', 'in_progress'])
        .order('due_at', { ascending: true })
        .limit(30);
      for (const t of data ?? []) {
        tasks.push({
          id: String(t.id),
          kind: 'visit',
          title: String(t.title ?? 'Scheduled visit'),
          subtitle: 'Visit task',
          dueAt: t.due_at ? String(t.due_at) : null,
          status: String(t.status),
          farmerId: t.farmer_id ? String(t.farmer_id) : null,
          leadId: t.lead_id ? String(t.lead_id) : null,
          refId: String(t.id),
        });
      }
    }

    if (!filter || filter === 'follow_up' || filter === 'all') {
      const { data } = await supabase
        .from('crm_tasks')
        .select('id, title, task_type, due_at, status, farmer_id, lead_id')
        .eq('assigned_to', email)
        .in('task_type', ['follow_up', 'call', 'other'])
        .lte('due_at', todayEnd)
        .in('status', ['pending', 'open', 'in_progress'])
        .order('due_at', { ascending: true })
        .limit(30);
      for (const t of data ?? []) {
        tasks.push({
          id: String(t.id),
          kind: 'follow_up',
          title: String(t.title ?? 'Follow-up'),
          subtitle: String(t.task_type),
          dueAt: t.due_at ? String(t.due_at) : null,
          status: String(t.status),
          farmerId: t.farmer_id ? String(t.farmer_id) : null,
          leadId: t.lead_id ? String(t.lead_id) : null,
          refId: String(t.id),
        });
      }
    }

    if (!filter || filter === 'callback' || filter === 'all') {
      const callbacks = await this.listCallbacks(email);
      for (const c of callbacks) {
        tasks.push({
          id: c.id,
          kind: 'callback',
          title: c.reason ?? 'Callback',
          subtitle: c.farmerName ?? c.phone ?? 'Farmer',
          dueAt: c.dueAt,
          status: c.status,
          farmerId: c.farmerId,
          refId: c.id,
        });
      }
    }

    if (!filter || filter === 'escalation' || filter === 'all') {
      const esc = await this.listEscalations({ status: 'open' });
      for (const e of esc) {
        tasks.push({
          id: e.id,
          kind: 'escalation',
          title: e.summary ?? e.type,
          subtitle: e.farmerName ?? 'Escalation',
          dueAt: null,
          status: e.status,
          farmerId: e.farmerId,
          refId: e.id,
        });
      }
    }

    if (!filter || filter === 'ai_review' || filter === 'all') {
      const queue = await agronomistCaseReviewService.listQueue({ status: 'open', page: 1, limit: 15 });
      for (const c of queue.items ?? []) {
        tasks.push({
          id: String(c.id),
          kind: 'ai_review',
          title: String(c.reason ?? 'AI review'),
          subtitle: c.confidence != null ? `Confidence ${Math.round(Number(c.confidence) * 100)}%` : 'Needs review',
          dueAt: c.createdAt ? String(c.createdAt) : null,
          status: String(c.status ?? 'open'),
          farmerId: null,
          refId: String(c.id),
        });
      }
    }

    if (!filter || filter === 'finding_review' || filter === 'all') {
      const fq = await agronomistWorkflowService.listReviewQueue(15);
      for (const raw of fq.items ?? []) {
        const item = raw as {
          finding: { id: string; blockName: string; cropType: string; visitedAt: string };
          farmer: { name?: string | null; phone?: string | null } | null;
          existingRecommendation: { status: string } | null;
        };
        tasks.push({
          id: item.finding.id,
          kind: 'finding_review',
          title: item.farmer?.name ?? item.farmer?.phone ?? 'Finding review',
          subtitle: `${item.finding.blockName} · ${item.finding.cropType}`,
          dueAt: item.finding.visitedAt,
          status: item.existingRecommendation?.status ?? 'pending',
          refId: item.finding.id,
        });
      }
    }

    return tasks;
  },

  async listCallbacks(_agentEmail: string) {
    const { data, error } = await supabase
      .from('callback_requests')
      .select('id, farmer_id, telecaller_notes, status, created_at, preferred_time, farmers(name, phone)')
      .in('status', ['pending', 'open', 'requested'])
      .order('created_at', { ascending: false })
      .limit(40);
    throwIfSupabaseError(error, 'Could not load callbacks');

    return (data ?? []).map((r) => {
      const f = r.farmers as { name?: string; phone?: string } | null;
      return {
        id: String(r.id),
        farmerId: String(r.farmer_id),
        farmerName: f?.name ?? null,
        phone: f?.phone ?? null,
        reason: r.telecaller_notes ? String(r.telecaller_notes) : null,
        status: String(r.status),
        requestedAt: String(r.created_at),
        dueAt: r.preferred_time ? String(r.preferred_time) : null,
      };
    });
  },

  async updateCallback(id: string, status: string) {
    const { data, error } = await supabase
      .from('callback_requests')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update callback');
    return data;
  },

  async createCallback(
    agentEmail: string,
    input: { farmerId: string; reason: string; dueInDays?: number }
  ) {
    const dueAt = new Date(Date.now() + (input.dueInDays ?? 5) * 24 * 60 * 60 * 1000).toISOString();
    const leadId = await resolveLeadId(input.farmerId);
    const { data, error } = await supabase
      .from('callback_requests')
      .insert({
        farmer_id: input.farmerId,
        lead_id: leadId,
        telecaller_notes: input.reason.slice(0, 500),
        status: 'pending',
        preferred_time: dueAt,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create callback');

    if (leadId) {
      await supabase.from('crm_tasks').insert({
        lead_id: leadId,
        farmer_id: input.farmerId,
        task_type: 'call',
        title: input.reason.slice(0, 120),
        status: 'pending',
        due_at: dueAt,
        assigned_to: agentEmail,
        notes: 'Callback from agronomist app',
      });
    }
    return data;
  },

  async listEscalations(opts?: { status?: string; farmerId?: string }) {
    let query = supabase
      .from('agronomist_escalations')
      .select('id, farmer_id, escalation_type, status, summary, created_at, farmers(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (opts?.status === 'open') {
      query = query.in('status', ['pending', 'assigned', 'in_review']);
    } else if (opts?.status) {
      query = query.eq('status', opts.status);
    }
    if (opts?.farmerId) query = query.eq('farmer_id', opts.farmerId);

    const { data, error } = await query;
    throwIfSupabaseError(error, 'Could not load escalations');

    return (data ?? []).map((r) => {
      const f = r.farmers as { name?: string } | null;
      return {
        id: String(r.id),
        farmerId: r.farmer_id ? String(r.farmer_id) : null,
        farmerName: f?.name ?? null,
        type: String(r.escalation_type ?? 'review'),
        status: String(r.status),
        summary: r.summary ? String(r.summary) : null,
        createdAt: String(r.created_at),
      };
    });
  },

  async getProfileStats(agentEmail: string) {
    const email = agentEmail.trim().toLowerCase();
    const intelligence = await agronomistIntelligenceService.getWorkspaceIntelligence(email);
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { count: visitsCompleted } = await supabase
      .from('crm_field_findings')
      .select('id', { count: 'exact', head: true })
      .eq('agronomist_name', email)
      .gte('visited_at', since90);

    const { count: recommendationsGiven } = await supabase
      .from('recommendation_records')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', email)
      .gte('created_at', since90);

    let recoverySuccessRate: number | null = null;
    try {
      const kpis = await recommendationFollowUpService.getKpis(30);
      recoverySuccessRate = (kpis as { recoveryRatePct?: number }).recoveryRatePct ?? null;
    } catch {
      /* optional */
    }

    return {
      assignedFarmers: intelligence.employee.attributedFarmers ?? intelligence.focusFarmers.length,
      visitsCompleted: visitsCompleted ?? 0,
      recommendationsGiven: recommendationsGiven ?? 0,
      recoverySuccessRate,
      performanceScore: intelligence.employee.performanceScore,
      openEscalations: intelligence.cohort.openEscalations,
    };
  },

  async startVisitSession(input: {
    farmerId: string;
    blockId?: string;
    agronomistEmail: string;
    latitude?: number;
    longitude?: number;
  }) {
    const { data, error } = await supabase
      .from('agronomist_visit_sessions')
      .insert({
        farmer_id: input.farmerId,
        block_id: input.blockId ?? null,
        agronomist_email: input.agronomistEmail.trim().toLowerCase(),
        status: 'in_progress',
        check_in_lat: input.latitude ?? null,
        check_in_lng: input.longitude ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not start visit session');
    return data;
  },

  async checkOutVisitSession(
    sessionId: string,
    input: { latitude?: number; longitude?: number; fieldFindingId?: string }
  ) {
    const { data: existing, error: loadErr } = await supabase
      .from('agronomist_visit_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    throwIfSupabaseError(loadErr, 'Session not found');
    if (!existing) throw new NotFoundError('Session not found');

    const checkOutAt = new Date();
    const checkInAt = new Date(String(existing.check_in_at));
    const durationMinutes = Math.max(1, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000));

    const { data, error } = await supabase
      .from('agronomist_visit_sessions')
      .update({
        status: 'completed',
        check_out_at: checkOutAt.toISOString(),
        check_out_lat: input.latitude ?? null,
        check_out_lng: input.longitude ?? null,
        duration_minutes: durationMinutes,
        field_finding_id: input.fieldFindingId ?? null,
        updated_at: checkOutAt.toISOString(),
      })
      .eq('id', sessionId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not check out');
    return data;
  },
};
