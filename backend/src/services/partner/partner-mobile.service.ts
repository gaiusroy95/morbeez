import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { fieldVisitService } from '../admin/field-visit.service.js';
import { partnerEnrollmentService } from './partner-enrollment.service.js';
import { partnerAttributionCaptureService } from './partner-attribution-capture.service.js';
import { partnerReliabilityService } from './partner-reliability.service.js';
import { partnerLeadAllocationService } from './partner-lead-allocation.service.js';
import { partnerTimelineService } from './partner-timeline.service.js';
import { farmerTeamTimelineService } from '../crm/farmer-team-timeline.service.js';
import { salesOpportunityService } from './sales-opportunity.service.js';
import { partnerFarmerWorkspaceService } from './partner-farmer-workspace.service.js';
import { routePlannerService } from '../agronomist/route-planner.service.js';
import type { StructuredFieldVisitInput } from '../../domain/ai-training/validators.js';

export const partnerMobileService = {
  async getDashboard(partnerId: string) {
    const { count: pendingTasks } = await supabase
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_partner_id', partnerId)
      .eq('status', 'pending');

    const monthStart = new Date();
    monthStart.setDate(1);
    const { count: visitsThisMonth } = await supabase
      .from('crm_field_findings')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partnerId)
      .gte('created_at', monthStart.toISOString());

    const { data: partner } = await supabase
      .from('partners')
      .select('current_active_farmers, reliability_score, performance_score')
      .eq('id', partnerId)
      .single();

    const offers = await partnerLeadAllocationService.listOffers(partnerId);
    const routesToday = await routePlannerService.countRoutesToday({
      agentType: 'partner',
      partnerId,
    });

    return {
      activeFarmers: Number(partner?.current_active_farmers ?? 0),
      pendingTasks: pendingTasks ?? 0,
      visitsThisMonth: visitsThisMonth ?? 0,
      routesToday,
      reliabilityScore: Number(partner?.reliability_score ?? 70),
      performanceScore: Number(partner?.performance_score ?? 50),
      leadOffersPending: offers.length,
    };
  },

  async listTasks(partnerId: string) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .select('id, title, task_type, task_category, due_at, status, farmer_id, lead_id, block_id, notes, priority')
      .eq('assigned_partner_id', partnerId)
      .in('status', ['pending', 'in_progress'])
      .order('due_at', { ascending: true })
      .limit(50);
    throwIfSupabaseError(error, 'Could not list tasks');
    return (data ?? []).map((t) => ({
      id: String(t.id),
      title: String(t.title ?? 'Task'),
      taskType: String(t.task_type),
      taskCategory: String(t.task_category ?? 'other'),
      dueAt: t.due_at ? String(t.due_at) : null,
      status: String(t.status),
      farmerId: t.farmer_id ? String(t.farmer_id) : null,
      leadId: t.lead_id ? String(t.lead_id) : null,
      blockId: t.block_id ? String(t.block_id) : null,
      priority: String(t.priority ?? 'medium'),
    }));
  },

  async acceptTask(taskId: string, partnerId: string) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('assigned_partner_id', partnerId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not accept task');
    if (!data) throw new NotFoundError('Task not found');
    return data;
  },

  async completeTask(taskId: string, partnerId: string) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('assigned_partner_id', partnerId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not complete task');
    if (!data) throw new NotFoundError('Task not found');
    return data;
  },

  async startVisitSession(input: {
    partnerId: string;
    farmerId: string;
    blockId?: string;
    latitude?: number;
    longitude?: number;
  }) {
    await this.assertFarmerAccess(input.partnerId, input.farmerId);
    const { data, error } = await supabase
      .from('agronomist_visit_sessions')
      .insert({
        farmer_id: input.farmerId,
        block_id: input.blockId ?? null,
        agent_type: 'partner',
        partner_id: input.partnerId,
        agronomist_email: `partner:${input.partnerId}`,
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
    partnerId: string,
    input: { latitude?: number; longitude?: number; fieldFindingId?: string }
  ) {
    const { data: existing, error: loadErr } = await supabase
      .from('agronomist_visit_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('partner_id', partnerId)
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

    if (input.fieldFindingId) {
      await partnerAttributionCaptureService.trackVisit(
        String(existing.farmer_id),
        partnerId,
        input.fieldFindingId
      );
      await partnerReliabilityService.captureVisitSignals({
        partnerId,
        farmerId: String(existing.farmer_id),
        hasGps: Boolean(input.latitude && input.longitude),
        photoCount: 1,
        issueCount: 1,
        durationMinutes,
      });
    }

    return data;
  },

  async submitVisit(input: StructuredFieldVisitInput, partnerId: string, partnerName: string) {
    await this.assertFarmerAccess(partnerId, input.farmerId);
    const agentEmail = `partner:${partnerId}`;
    const result = await fieldVisitService.submitStructuredVisitForPartner(
      input,
      agentEmail,
      partnerId,
      partnerName
    );
    if (input.sessionId) {
      await this.checkOutVisitSession(input.sessionId, partnerId, {
        latitude: input.latitude,
        longitude: input.longitude,
        fieldFindingId: result.findingId,
      });
    }
    await farmerTeamTimelineService.addSystemEntry({
      farmerId: input.farmerId,
      title: 'Visit completed',
      body: 'Partner submitted field findings',
      fieldFindingId: result.findingId,
      metadata: { partnerId },
    });
    return result;
  },

  async rejectTask(taskId: string, partnerId: string, reason: string) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .update({
        status: 'cancelled',
        reject_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('assigned_partner_id', partnerId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not reject task');
    return data;
  },

  async rescheduleTask(taskId: string, partnerId: string, dueAt: string) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .update({ due_at: dueAt, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('assigned_partner_id', partnerId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not reschedule task');
    return data;
  },

  async listVisits(partnerId: string, limit = 40) {
    const { data, error } = await supabase
      .from('crm_field_findings')
      .select(
        'id, farmer_id, block_id, block_name, disease_pest, observations, visited_at, created_at, farmers(name, first_name, last_name)'
      )
      .eq('partner_id', partnerId)
      .is('archived_at', null)
      .order('visited_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not list visits');
    return (data ?? []).map((v) => {
      const farmerRaw = v.farmers as
        | { name?: string; first_name?: string; last_name?: string }
        | Array<{ name?: string; first_name?: string; last_name?: string }>
        | null;
      const farmer = Array.isArray(farmerRaw) ? farmerRaw[0] : farmerRaw;
      const first = String(farmer?.first_name ?? '').trim();
      const last = String(farmer?.last_name ?? '').trim();
      const farmerName =
        [first, last].filter(Boolean).join(' ') || String(farmer?.name ?? '').trim() || undefined;
      const summary = String(v.disease_pest ?? v.observations ?? v.block_name ?? '').slice(0, 120);

      return {
        id: String(v.id),
        farmerId: String(v.farmer_id),
        farmerName,
        blockId: v.block_id ? String(v.block_id) : null,
        visitedAt: String(v.visited_at ?? v.created_at),
        summary: summary || undefined,
      };
    });
  },

  async listNotifications(partnerId: string) {
    const notifications: Array<{
      id: string;
      category: string;
      title: string;
      detail?: string;
      at: string;
      farmerId?: string;
      taskId?: string;
    }> = [];

    const [tasksRes, offersRes] = await Promise.all([
      supabase
        .from('crm_tasks')
        .select('id, title, due_at, farmer_id')
        .eq('assigned_partner_id', partnerId)
        .eq('status', 'pending')
        .order('due_at', { ascending: true })
        .limit(20),
      supabase
        .from('partner_lead_allocations')
        .select('id, offered_at, status')
        .eq('partner_id', partnerId)
        .eq('status', 'offered')
        .limit(10),
    ]);

    for (const t of tasksRes.data ?? []) {
      notifications.push({
        id: `task-${t.id}`,
        category: 'new_task',
        title: String(t.title ?? 'Task'),
        detail: t.due_at ? String(t.due_at) : undefined,
        at: String(t.due_at ?? new Date().toISOString()),
        farmerId: t.farmer_id ? String(t.farmer_id) : undefined,
        taskId: String(t.id),
      });
    }
    for (const o of offersRes.data ?? []) {
      notifications.push({
        id: `offer-${o.id}`,
        category: 'lead_offer',
        title: 'New lead offer',
        at: String(o.offered_at ?? new Date().toISOString()),
      });
    }
    notifications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return notifications;
  },

  async saveBlockLocation(input: {
    blockId: string;
    farmerId: string;
    latitude: number;
    longitude: number;
  }) {
    const { fieldPwaService } = await import('../admin/field-pwa.service.js');
    return fieldPwaService.saveBlockLocation(input);
  },

  async assertFarmerAccess(partnerId: string, farmerId: string) {
    const { data } = await supabase
      .from('farmers')
      .select('id')
      .eq('id', farmerId)
      .or(
        `assigned_partner_id.eq.${partnerId},customer_owner_partner_id.eq.${partnerId},enrollment_owner_partner_id.eq.${partnerId}`
      )
      .maybeSingle();
    if (!data) throw new ValidationError('Farmer is not assigned to this partner');
  },

  async getFarmerWorkspace(partnerId: string, farmerId: string) {
    await this.assertFarmerAccess(partnerId, farmerId);
    return partnerFarmerWorkspaceService.buildWorkspace(partnerId, farmerId);
  },

  async createSupportRequest(
    partnerId: string,
    farmerId: string,
    input: { requestType: string; notes: string },
    partnerName: string
  ) {
    await this.assertFarmerAccess(partnerId, farmerId);
    const titleByType: Record<string, string> = {
      expert_opinion: 'Expert opinion requested',
      soil_interpretation: 'Soil interpretation help',
      joint_visit: 'Joint visit requested',
      disease_confirmation: 'Disease confirmation needed',
    };
    const title = titleByType[input.requestType] ?? 'Support request';
    await partnerTimelineService.addEntry({
      farmerId,
      body: `${title}: ${input.notes}`,
      authorType: 'partner',
      partnerId,
      authorName: partnerName,
      entryType: 'support_request',
    });
    await farmerTeamTimelineService.addSystemEntry({
      farmerId,
      title,
      body: input.notes,
      metadata: { requestType: input.requestType, partnerId },
    });
    const { data: farmer } = await supabase
      .from('farmers')
      .select('assigned_expert_email')
      .eq('id', farmerId)
      .maybeSingle();
    if (farmer?.assigned_expert_email) {
      await supabase.from('crm_tasks').insert({
        farmer_id: farmerId,
        title,
        task_type: 'review',
        task_category: 'support_request',
        status: 'pending',
        assigned_to: String(farmer.assigned_expert_email),
        assigned_to_role: 'expert',
        notes: input.notes,
        created_by: partnerName,
      });
    }
    return { ok: true };
  },

  listPartnerFarmers: partnerFarmerWorkspaceService.listPartnerFarmers.bind(partnerFarmerWorkspaceService),
};
