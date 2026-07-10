import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { formatPhoneE164 } from '../../lib/phone.js';
import { fieldPwaService } from '../admin/field-pwa.service.js';
import { crmFarmerService } from '../admin/crm-farmer.service.js';
import { farmerTeamTimelineService } from '../crm/farmer-team-timeline.service.js';
import { farmerOwnershipService } from './farmer-ownership.service.js';
import { salesOpportunityService } from './sales-opportunity.service.js';
import { recommendationRecordsService } from '../core/recommendation-records.service.js';
import { agronomistMobileService } from '../agronomist/agronomist-mobile.service.js';
import { sanitizePartnerPayload } from './partner-response-sanitizer.js';

export type PartnerSuggestedAction =
  | 'field_visit'
  | 'follow_up'
  | 'soil_sampling'
  | 'callback'
  | 'none';

export type PartnerFarmSnapshot = {
  totalAcreage: number | null;
  activeBlockCount: number;
  primaryCrop: string | null;
  cropStatus: string | null;
};

export type PartnerCurrentRecommendation = {
  id: string;
  title: string;
  status: string;
} | null;

export type PartnerFarmerHeader = {
  id: string;
  name: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  primaryCrop: string | null;
  totalAcreage: number | null;
  customerOwnerType: string | null;
  assignedTelecallerEmail: string | null;
  serviceModel: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type PartnerFarmerListRow = {
  id: string;
  name: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  primaryCrop: string | null;
  totalAcreage: number | null;
  lastOrderDate: string | null;
  suggestedAction: PartnerSuggestedAction;
  suggestedActionLabel: string;
};

const SUGGESTED_LABELS: Record<PartnerSuggestedAction, string> = {
  field_visit: 'Field visit',
  follow_up: 'Follow-up',
  soil_sampling: 'Soil sampling',
  callback: 'Schedule callback',
  none: '—',
};

function primaryCropFromBlocks(blocks: Array<Record<string, unknown>>): string | null {
  const primary = blocks.find((b) => b.isPrimary || b.is_primary);
  const crop = primary?.cropType ?? primary?.crop_type ?? blocks[0]?.cropType ?? blocks[0]?.crop_type;
  return crop ? String(crop) : null;
}

function cropStatusFromBlocks(blocks: Array<Record<string, unknown>>): string | null {
  const worst = blocks.find((b) => b.needsAttention || b.needs_attention);
  if (worst) return String(worst.healthStatus ?? worst.health_status ?? 'needs_attention');
  const first = blocks[0];
  return first ? String(first.healthStatus ?? first.health_status ?? 'unknown') : null;
}

function blockCoords(blocks: Array<Record<string, unknown>>): { lat: number | null; lng: number | null } {
  for (const b of blocks) {
    const lat = b.latitude != null ? Number(b.latitude) : null;
    const lng = b.longitude != null ? Number(b.longitude) : null;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return { lat: null, lng: null };
}

export function computeSuggestedAction(input: {
  pendingPartnerTasks: number;
  daysSinceLastVisit: number | null;
  openIssueCount: number;
  hasSoilTask: boolean;
}): PartnerSuggestedAction {
  if (input.pendingPartnerTasks > 0 && input.hasSoilTask) return 'soil_sampling';
  if (input.pendingPartnerTasks > 0) return 'field_visit';
  if (input.openIssueCount > 0) return 'field_visit';
  if (input.daysSinceLastVisit != null && input.daysSinceLastVisit > 21) return 'field_visit';
  if (input.daysSinceLastVisit != null && input.daysSinceLastVisit > 14) return 'follow_up';
  return 'none';
}

export const partnerFarmerWorkspaceService = {
  suggestedActionLabel(action: PartnerSuggestedAction): string {
    return SUGGESTED_LABELS[action];
  },

  async getLastOrderDate(farmerId: string): Promise<string | null> {
    const { data } = await supabase
      .from('commerce_orders')
      .select('created_at')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.created_at ? String(data.created_at).slice(0, 10) : null;
  },

  async listPartnerFarmers(partnerId: string, limit = 50): Promise<PartnerFarmerListRow[]> {
    const { data, error } = await supabase
      .from('farmers')
      .select('id, name, phone, village, district, total_acreage, created_at')
      .or(
        `enrollment_owner_partner_id.eq.${partnerId},assigned_partner_id.eq.${partnerId},customer_owner_partner_id.eq.${partnerId}`
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not list partner farmers');

    const rows = await Promise.all(
      (data ?? []).map(async (f) => {
        const farmerId = String(f.id);
        const [blocks, lastOrderDate, pendingTasks, lastVisit] = await Promise.all([
          fieldPwaService.getFarmerBlocks(farmerId).catch(() => []),
          this.getLastOrderDate(farmerId),
          supabase
            .from('crm_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('farmer_id', farmerId)
            .eq('assigned_partner_id', partnerId)
            .in('status', ['pending', 'in_progress']),
          supabase
            .from('crm_field_findings')
            .select('visited_at')
            .eq('farmer_id', farmerId)
            .eq('partner_id', partnerId)
            .order('visited_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        const openIssues = blocks.reduce(
          (sum, b) => sum + Number((b as Record<string, unknown>).openIssueCount ?? 0),
          0
        );
        const lastVisitAt = lastVisit.data?.visited_at ? String(lastVisit.data.visited_at) : null;
        const daysSince = lastVisitAt
          ? Math.floor((Date.now() - new Date(lastVisitAt).getTime()) / 86400000)
          : null;
        const suggestedAction = computeSuggestedAction({
          pendingPartnerTasks: pendingTasks.count ?? 0,
          daysSinceLastVisit: daysSince,
          openIssueCount: openIssues,
          hasSoilTask: false,
        });
        return {
          id: farmerId,
          name: String(f.name ?? 'Farmer'),
          phone: formatPhoneE164(f.phone != null ? String(f.phone) : null),
          village: f.village ? String(f.village) : null,
          district: f.district ? String(f.district) : null,
          primaryCrop: primaryCropFromBlocks(blocks as Array<Record<string, unknown>>),
          totalAcreage: f.total_acreage != null ? Number(f.total_acreage) : null,
          lastOrderDate,
          suggestedAction,
          suggestedActionLabel: SUGGESTED_LABELS[suggestedAction],
        };
      })
    );
    return rows;
  },

  async buildWorkspace(partnerId: string, farmerId: string) {
    const { data: farmerRow, error } = await supabase
      .from('farmers')
      .select(
        'id, name, phone, village, district, service_model, preferred_language, total_acreage, assigned_telecaller_email, assigned_expert_email, customer_owner_type'
      )
      .eq('id', farmerId)
      .single();
    throwIfSupabaseError(error, 'Could not load farmer');

    const [
      blocks,
      timeline,
      ownership,
      opportunities,
      partnerVisits,
      openRecsRes,
      lastVisitRes,
      pendingTasksRes,
      soilTasksRes,
      recRows,
    ] = await Promise.all([
      fieldPwaService.getFarmerBlocks(farmerId),
      farmerTeamTimelineService.listForFarmer(farmerId, 60),
      farmerOwnershipService.getOwnership(farmerId),
      salesOpportunityService.listForFarmer(farmerId),
      supabase
        .from('crm_field_findings')
        .select('id, farmer_id, block_id, visited_at, observations, disease_pest, partner_id')
        .eq('farmer_id', farmerId)
        .eq('partner_id', partnerId)
        .order('visited_at', { ascending: false })
        .limit(20),
      supabase
        .from('recommendation_records')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .in('status', ['draft', 'open', 'monitoring']),
      supabase
        .from('crm_field_findings')
        .select('visited_at')
        .eq('farmer_id', farmerId)
        .order('visited_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .eq('assigned_partner_id', partnerId)
        .in('status', ['pending', 'in_progress']),
      supabase
        .from('crm_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('farmer_id', farmerId)
        .eq('assigned_partner_id', partnerId)
        .in('status', ['pending', 'in_progress'])
        .eq('task_category', 'soil_sampling'),
      recommendationRecordsService.listByFarmer(farmerId, 5),
    ]);

    const openIssueCount = blocks.reduce((sum, b) => sum + Number(b.openIssueCount ?? 0), 0);
    const lastVisitAt = lastVisitRes.data?.visited_at ? String(lastVisitRes.data.visited_at) : null;
    const daysSince = lastVisitAt
      ? Math.floor((Date.now() - new Date(lastVisitAt).getTime()) / 86400000)
      : null;
    const suggestedAction = computeSuggestedAction({
      pendingPartnerTasks: pendingTasksRes.count ?? 0,
      daysSinceLastVisit: daysSince,
      openIssueCount,
      hasSoilTask: (soilTasksRes.count ?? 0) > 0,
    });

    const partnerIds = [
      ownership?.enrollmentOwnerPartnerId,
      ownership?.customerOwnerPartnerId,
      ownership?.assignedPartnerId,
    ].filter(Boolean) as string[];
    const partnerNameById = new Map<string, string>();
    if (partnerIds.length) {
      const { data: partnerRows } = await supabase
        .from('partners')
        .select('id, full_name, partner_code')
        .in('id', [...new Set(partnerIds)]);
      for (const p of partnerRows ?? []) {
        partnerNameById.set(String(p.id), String(p.full_name ?? p.partner_code ?? 'Partner'));
      }
    }
    const ownershipWithNames = ownership
      ? {
          ...ownership,
          enrollmentOwnerPartnerName: ownership.enrollmentOwnerPartnerId
            ? partnerNameById.get(ownership.enrollmentOwnerPartnerId) ?? null
            : null,
          customerOwnerPartnerName: ownership.customerOwnerPartnerId
            ? partnerNameById.get(ownership.customerOwnerPartnerId) ?? null
            : null,
          assignedPartnerName: ownership.assignedPartnerId
            ? partnerNameById.get(ownership.assignedPartnerId) ?? null
            : null,
          assignedExpertEmail: farmerRow!.assigned_expert_email
            ? String(farmerRow!.assigned_expert_email)
            : ownership.assignedExpertEmail,
        }
      : null;

    const currentRecRow = recRows.find((r) => ['open', 'monitoring', 'draft'].includes(String(r.status)));
    const currentRecommendation: PartnerCurrentRecommendation = currentRecRow
      ? {
          id: String(currentRecRow.id),
          title: String(currentRecRow.recommendation_text ?? currentRecRow.issue_detected ?? 'Recommendation'),
          status: String(currentRecRow.status),
        }
      : null;

    const coords = blockCoords(blocks as Array<Record<string, unknown>>);
    const farmSnapshot: PartnerFarmSnapshot = {
      totalAcreage: farmerRow?.total_acreage != null ? Number(farmerRow.total_acreage) : null,
      activeBlockCount: blocks.length,
      primaryCrop: primaryCropFromBlocks(blocks as Array<Record<string, unknown>>),
      cropStatus: cropStatusFromBlocks(blocks as Array<Record<string, unknown>>),
    };

    const header: PartnerFarmerHeader = {
      id: String(farmerRow!.id),
      name: String(farmerRow!.name ?? 'Farmer'),
      phone: formatPhoneE164(farmerRow!.phone != null ? String(farmerRow!.phone) : null),
      village: farmerRow!.village ? String(farmerRow!.village) : null,
      district: farmerRow!.district ? String(farmerRow!.district) : null,
      primaryCrop: farmSnapshot.primaryCrop,
      totalAcreage: farmSnapshot.totalAcreage,
      customerOwnerType: farmerRow!.customer_owner_type ? String(farmerRow!.customer_owner_type) : null,
      assignedTelecallerEmail: farmerRow!.assigned_telecaller_email
        ? String(farmerRow!.assigned_telecaller_email)
        : null,
      serviceModel: farmerRow!.service_model ? String(farmerRow!.service_model) : null,
      latitude: coords.lat,
      longitude: coords.lng,
    };

    const recentVisits = (partnerVisits.data ?? []).map((v) => ({
      id: String(v.id),
      farmerId: String(v.farmer_id),
      blockId: v.block_id ? String(v.block_id) : null,
      visitedAt: String(v.visited_at),
      summary: String(v.observations ?? v.disease_pest ?? 'Field visit'),
      status: 'completed',
    }));

    return sanitizePartnerPayload({
      farmer: header,
      header,
      blocks,
      timeline,
      ownership: ownershipWithNames,
      farmSnapshot,
      currentRecommendation,
      suggestedAction,
      suggestedActionLabel: SUGGESTED_LABELS[suggestedAction],
      pendingTaskCount: pendingTasksRes.count ?? 0,
      openRecommendationsCount: openRecsRes.count ?? 0,
      lastVisitAt,
      salesOpportunities: opportunities,
      recentVisits,
    });
  },

  async listFarmerTasks(partnerId: string, farmerId: string) {
    const { data, error } = await supabase
      .from('crm_tasks')
      .select('id, title, task_type, task_category, due_at, status, farmer_id, block_id, notes, priority')
      .eq('farmer_id', farmerId)
      .eq('assigned_partner_id', partnerId)
      .in('status', ['pending', 'in_progress'])
      .order('due_at', { ascending: true });
    throwIfSupabaseError(error, 'Could not list tasks');
    return (data ?? []).map((t) => ({
      id: String(t.id),
      title: String(t.title ?? 'Task'),
      taskType: String(t.task_type),
      taskCategory: String(t.task_category ?? 'other'),
      dueAt: t.due_at ? String(t.due_at) : null,
      status: String(t.status),
      farmerId: String(t.farmer_id),
      blockId: t.block_id ? String(t.block_id) : null,
      priority: String(t.priority ?? 'medium'),
      notes: t.notes ? String(t.notes) : null,
    }));
  },

  async listFarmerOrders(farmerId: string) {
    const { data, error } = await supabase
      .from('commerce_orders')
      .select('id, created_at, status, line_items, fulfillment_status')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(30);
    throwIfSupabaseError(error, 'Could not load orders');
    return (data ?? []).map((o) => {
      const items = (o.line_items as Array<Record<string, unknown>> | null) ?? [];
      const products = items
        .map((i) => String(i.title ?? i.product_name ?? i.name ?? 'Product'))
        .join(', ');
      const qty = items.reduce((sum, i) => sum + Number(i.quantity ?? 1), 0);
      return {
        id: String(o.id),
        orderDate: String(o.created_at).slice(0, 10),
        products: products || 'Order',
        quantity: qty || items.length,
        deliveryStatus: String(o.fulfillment_status ?? o.status ?? 'unknown'),
      };
    });
  },

  async listFarmerEscalations(farmerId: string) {
    const { data, error } = await supabase
      .from('farmer_timeline_entries')
      .select('id, body, entry_type, created_at, metadata')
      .eq('farmer_id', farmerId)
      .in('entry_type', ['escalation', 'support_request'])
      .order('created_at', { ascending: false })
      .limit(40);
    throwIfSupabaseError(error, 'Could not load escalations');
    return (data ?? []).map((e) => {
      const meta = (e.metadata as Record<string, unknown> | null) ?? {};
      const status = String(meta.status ?? meta.resolutionStatus ?? 'open');
      const normalized =
        status.includes('resolve') ? 'resolved' : status.includes('review') ? 'under_review' : 'open';
      return {
        id: String(e.id),
        body: String(e.body),
        entryType: String(e.entry_type),
        status: normalized,
        createdAt: String(e.created_at),
      };
    });
  },

  async createEscalation(
    partnerId: string,
    farmerId: string,
    input: { category: string; notes: string },
    partnerName: string
  ) {
    const { partnerTimelineService } = await import('./partner-timeline.service.js');
    const entry = await partnerTimelineService.addEntry({
      farmerId,
      body: `[${input.category}] ${input.notes}`,
      authorType: 'partner',
      partnerId,
      authorName: partnerName,
      entryType: 'escalation',
      metadata: { category: input.category, status: 'open' },
    });
    await farmerTeamTimelineService.addSystemEntry({
      farmerId,
      title: `Escalation: ${input.category}`,
      body: input.notes,
      metadata: { partnerId, category: input.category },
    });
    return entry;
  },

  async scheduleCallback(partnerId: string, farmerId: string, notes: string, partnerName: string) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 1);
    const { data, error } = await supabase
      .from('crm_tasks')
      .insert({
        farmer_id: farmerId,
        title: 'Partner callback scheduled',
        task_type: 'follow_up',
        task_category: 'callback',
        status: 'pending',
        assigned_partner_id: partnerId,
        due_at: dueAt.toISOString(),
        notes,
        created_by: partnerName,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not schedule callback');
    return data;
  },

  async listVisitSessions(partnerId: string, farmerId: string) {
    const { data, error } = await supabase
      .from('agronomist_visit_sessions')
      .select('id, farmer_id, block_id, status, check_in_at, check_out_at, duration_minutes')
      .eq('partner_id', partnerId)
      .eq('farmer_id', farmerId)
      .order('check_in_at', { ascending: false })
      .limit(20);
    throwIfSupabaseError(error, 'Could not load sessions');
    return (data ?? []).map((s) => ({
      id: String(s.id),
      farmerId: String(s.farmer_id),
      blockId: s.block_id ? String(s.block_id) : null,
      status: String(s.status),
      checkInAt: String(s.check_in_at),
      checkOutAt: s.check_out_at ? String(s.check_out_at) : null,
      durationMinutes: s.duration_minutes != null ? Number(s.duration_minutes) : null,
    }));
  },

  async getBlockDetail(farmerId: string, blockId: string) {
    const detail = await agronomistMobileService.getBlockDetail(farmerId, blockId);
    return {
      ...detail,
      activities: (detail.activities ?? []).map(({ costInr: _c, ...rest }: Record<string, unknown>) => rest),
    };
  },

  async getBlockTimeline(farmerId: string, blockId: string) {
    return crmFarmerService.blockTimeline(farmerId, blockId);
  },

  async listFarmerRecommendations(farmerId: string) {
    const rows = await recommendationRecordsService.listByFarmer(farmerId, 30);
    return rows.map((r) => ({
      id: String(r.id),
      blockId: r.block_id ? String(r.block_id) : null,
      recommendationText: String(r.recommendation_text ?? ''),
      status: String(r.status),
      createdAt: String(r.created_at),
    }));
  },

  async getInteractions(farmerId: string) {
    return farmerTeamTimelineService.listForFarmer(farmerId, 80);
  },

  async addTeamComment(
    partnerId: string,
    farmerId: string,
    body: string,
    partnerName: string
  ) {
    const { partnerTimelineService } = await import('./partner-timeline.service.js');
    return partnerTimelineService.addEntry({
      farmerId,
      body,
      authorType: 'partner',
      partnerId,
      authorName: partnerName,
      entryType: 'comment',
    });
  },
};
