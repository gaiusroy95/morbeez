import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import {
  assertAdminPasswordConfirm,
  assertSuperAdminPasswordConfirm,
  confirmPasswordSchema,
} from '../../lib/super-admin-password.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { structuredFieldFindingSchema } from '../../domain/ai-training/validators.js';
import { telecallerAdminService } from '../../services/admin/telecaller-admin.service.js';
import { opportunityIntelligenceDashboardService } from '../../services/intelligence/opportunity-intelligence-dashboard.service.js';
import { telecallerIntelligenceService } from '../../services/intelligence/telecaller-intelligence.service.js';
import { crmFarmerService, type MasterType } from '../../services/admin/crm-farmer.service.js';
import { commerceQuoteService } from '../../services/commerce/commerce-quote.service.js';
import { whatsappOsAdminService } from '../../services/admin/whatsapp-os-admin.service.js';
import { escalationAdminService } from '../../services/admin/escalation-admin.service.js';
import { farmerRoiAdminService } from '../../services/admin/farmer-roi-admin.service.js';
import { telecallerFarmerProfileService } from '../../services/admin/telecaller-farmer-profile.service.js';
import { pincodeService } from '../../services/core/pincode.service.js';
import {
  telecallerLeadQueueService,
  type OperationalLeadSort,
} from '../../services/admin/telecaller-lead-queue.service.js';
import { userTablePreferencesService } from '../../services/admin/user-table-preferences.service.js';
import { agronomistCaseReviewService } from '../../services/admin/agronomist-case-review.service.js';

const callOutcomeEnum = z.enum([
  'answered',
  'connected',
  'callback',
  'no_answer',
  'busy',
  'completed',
]);

const leadStageEnum = z.enum([
  'new_lead',
  'interested',
  'follow_up',
  'recommendation',
  'order_placed',
  'repeat_customer',
]);

export async function osTelecallerRoutes(app: FastifyInstance): Promise<void> {
  const api = '/morbeez-staff/api/v1/os/telecaller';

  app.get(`${api}/diagnosis-labels`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = z
      .object({
        cropType: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(request.query ?? {});
    const labels = await agronomistCaseReviewService.listDiagnosisLabels({
      cropType: q.cropType,
      search: q.search,
    });
    return reply.send({ ok: true, labels });
  });

  app.post(`${api}/diagnosis-labels`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const body = z
      .object({
        label: z.string().min(1).max(500),
        cropType: z.string().max(80).nullable().optional(),
      })
      .parse(request.body);
    const created = await agronomistCaseReviewService.createDiagnosisLabel(body);
    return reply.status(201).send({ ok: true, ...created });
  });

  app.get(`${api}/overview`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const overview = await telecallerAdminService.getOverview(admin.email);
    const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true });
    overview.allLeadsCount = count ?? 0;
    return reply.send({ ok: true, overview });
  });

  app.get(`${api}/workspace-intelligence`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const intelligence = await telecallerIntelligenceService.getWorkspaceIntelligence(admin.email);
    return reply.send({ ok: true, intelligence });
  });

  app.get(`${api}/nav-badges`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const badges = await telecallerAdminService.getNavBadges();
    return reply.send({ ok: true, badges });
  });

  app.get(`${api}/leads`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as {
      scope?: string;
      stage?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
    const result = await telecallerAdminService.listLeads(
      {
        scope: q.scope === 'mine' ? 'mine' : 'all',
        stage: q.stage,
        search: q.search,
        page: q.page ? Number(q.page) : 1,
        limit: q.limit ? Number(q.limit) : 30,
      },
      admin.email
    );
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/leads/operational`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as Record<string, string | undefined>;
    const result = await telecallerLeadQueueService.listOperationalLeads(
      {
        scope: q.scope === 'all' ? 'all' : 'mine',
        stage: q.stage,
        search: q.search,
        district: q.district,
        pincode: q.pincode,
        language: q.language,
        crop: q.crop,
        owner: q.owner,
        pendingTasks: q.pendingTasks === 'true' || q.pendingTasks === '1',
        escalations: q.escalations === 'true' || q.escalations === '1',
        opportunityLevel: q.opportunityLevel as 'high' | 'medium' | 'low' | undefined,
        smartFilter: q.smartFilter as
          | 'all'
          | 'pending'
          | 'escalated'
          | 'overdue'
          | 'due_today'
          | 'hot_leads'
          | 'high_acreage'
          | 'no_engagement'
          | undefined,
        sort: (q.sort as
          | 'priority'
          | 'pending_tasks'
          | 'escalations'
          | 'opportunity_score'
          | 'relationship_score'
          | 'acreage'
          | 'follow_up_due'
          | 'recent_interaction'
          | 'recently_added'
          | undefined) ?? 'priority',
        limit: q.limit ? Number(q.limit) : 120,
      },
      admin.email
    );
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/leads/queue-summary`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { scope?: string };
    const summary = await telecallerLeadQueueService.getQueueSummary(
      admin.email,
      q.scope === 'all' ? 'all' : 'mine'
    );
    return reply.send({ ok: true, summary });
  });

  app.get(`${api}/leads/export`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as Record<string, string | undefined>;
    const leadIds = q.leadIds?.split(',').filter(Boolean);
    const { csv } = await telecallerLeadQueueService.exportLeads(
      {
        scope: q.scope === 'all' ? 'all' : 'mine',
        stage: q.stage,
        search: q.search,
        district: q.district,
        pincode: q.pincode,
        language: q.language,
        crop: q.crop,
        owner: q.owner,
        pendingTasks: q.pendingTasks === 'true' || q.pendingTasks === '1',
        escalations: q.escalations === 'true' || q.escalations === '1',
        opportunityLevel: q.opportunityLevel as 'high' | 'medium' | 'low' | undefined,
        smartFilter: q.smartFilter as
          | 'all'
          | 'pending'
          | 'escalated'
          | 'overdue'
          | 'due_today'
          | 'hot_leads'
          | 'high_acreage'
          | 'no_engagement'
          | undefined,
        sort: (q.sort as OperationalLeadSort | undefined) ?? 'priority',
        limit: q.limit ? Number(q.limit) : 200,
      },
      admin.email,
      leadIds
    );
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header(
      'Content-Disposition',
      `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return reply.send(csv);
  });

  app.post(`${api}/leads/bulk`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const body = z
      .object({
        leadIds: z.array(z.string().uuid()).min(1),
        action: z.enum([
          'change_owner',
          'assign_employee',
          'change_stage',
          'add_broadcast_tag',
          'delete',
        ]),
        owner: z.string().email().optional(),
        stage: leadStageEnum.optional(),
        broadcastTag: z.string().min(1).max(80).optional(),
      })
      .parse(request.body);
    const result = await telecallerLeadQueueService.bulkUpdateLeads(
      body.leadIds,
      body.action,
      { owner: body.owner, stage: body.stage, broadcastTag: body.broadcastTag },
      admin.email
    );
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/team`, async (_request, reply) => {
    await assertModuleAccess(_request, 'telecaller_crm', 'read');
    const team = await telecallerLeadQueueService.listAssignableTeam();
    return reply.send({ ok: true, team });
  });

  app.get(`${api}/table-preferences`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { table?: string; view?: string };
    const tableName = z.string().min(1).parse(q.table ?? 'telecaller_leads');
    const viewName = q.view?.trim() || 'active';
    const prefs = await userTablePreferencesService.get(admin.email, tableName, viewName);
    const views = await userTablePreferencesService.listViews(admin.email, tableName);
    return reply.send({ ok: true, preferences: prefs, views });
  });

  app.put(`${api}/table-preferences`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const body = z
      .object({
        tableName: z.string().min(1).default('telecaller_leads'),
        viewName: z.string().min(1).optional(),
        visibleColumns: z.array(z.string()).optional(),
        columnOrder: z.array(z.string()).optional(),
        columnWidths: z.record(z.number()).optional(),
        filterState: z.record(z.unknown()).optional(),
      })
      .parse(request.body);
    const prefs = await userTablePreferencesService.upsert(admin.email, body.tableName, body);
    return reply.send({ ok: true, preferences: prefs });
  });

  app.get(`${api}/marketing-owners`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { marketingPerformanceService } = await import(
      '../../services/admin/marketing-performance.service.js'
    );
    const owners = await marketingPerformanceService.listMarketingOwners();
    return reply.send({ ok: true, owners });
  });

  app.get(`${api}/leads/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    return reply.send({ ok: true, ...detail });
  });

  app.patch(`${api}/leads/:id`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        stage: leadStageEnum.optional(),
        notes: z.string().optional(),
        followUpAt: z.string().nullable().optional(),
        assignedTo: z.string().nullable().optional(),
        priority: z.string().optional(),
        leadChannel: z
          .enum(['meta', 'instagram', 'google', 'referral', 'organic', 'whatsapp', 'field', 'other'])
          .nullable()
          .optional(),
        campaignSource: z.string().nullable().optional(),
        marketingOwnerId: z.string().uuid().nullable().optional(),
        marketingOwnerName: z.string().nullable().optional(),
        utmCampaign: z.string().nullable().optional(),
        utmSource: z.string().nullable().optional(),
        utmMedium: z.string().nullable().optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.updateLead(id, body, admin.email);
    return reply.send({ ok: true, ...detail });
  });

  app.post(`${api}/leads/:id/notes`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const { note } = z.object({ note: z.string().min(1) }).parse(request.body);
    const detail = await telecallerAdminService.addNote(id, note, admin.email);
    return reply.send({ ok: true, ...detail });
  });

  app.get(`${api}/pincodes/:pincode`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { pincode } = request.params as { pincode: string };
    const row = await pincodeService.lookupByPincode(pincode);
    if (!row) return reply.code(404).send({ ok: false, error: 'Pincode not found' });
    return reply.send({ ok: true, pincode: row });
  });

  app.get(`${api}/leads/:id/farmer-profile`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const profile = await telecallerFarmerProfileService.getProfile(detail.lead.farmerId as string);
    return reply.send({ ok: true, ...profile });
  });

  app.get(`${api}/leads/:id/intelligence`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const profile = await opportunityIntelligenceDashboardService.getFarmerProfile(
      String(detail.lead.farmerId)
    );
    return reply.send({ ok: true, profile });
  });

  app.patch(`${api}/leads/:id/farmer-profile`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const body = z
      .object({
        name: z.string().optional(),
        whatsappSame: z.boolean().optional(),
        whatsappPhone: z.string().optional(),
        language: z.string().optional(),
        pincode: z.string().optional(),
        village: z.string().optional(),
        totalAcreage: z.number().optional(),
        shippingAddress: z.string().optional(),
        deliveryPincode: z.string().optional(),
        assignedCropAdvisor: z.string().optional(),
        roiEnabled: z.boolean().optional(),
        farmerNotes: z.string().optional(),
        cropExperienceYears: z.number().int().min(0).max(60).optional(),
        cropBlocks: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              blockName: z.string().optional(),
              cropName: z.string(),
              acreage: z.number().optional(),
              plantingDate: z.string().optional(),
              latitude: z.number().min(6).max(37.5).optional(),
              longitude: z.number().min(68).max(97.5).optional(),
            })
          )
          .optional(),
      })
      .parse(request.body);
    const profile = await telecallerFarmerProfileService.updateProfile(
      detail.lead.farmerId as string,
      body
    );
    return reply.send({ ok: true, ...profile });
  });

  app.get(`${api}/leads/:id/roi-entries`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const result = await farmerRoiAdminService.listEntries(detail.lead.farmerId as string);
    return reply.send({ ok: true, ...result });
  });

  app.patch(`${api}/leads/:id/roi-entries/:entryId`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id, entryId } = request.params as { id: string; entryId: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const body = z
      .object({
        password: z.string().min(1),
        entryDate: z.string().optional(),
        category: z.enum(['labour', 'purchase', 'misc', 'harvest', 'income']).optional(),
        comments: z.string().nullable().optional(),
        debitInr: z.number().nullable().optional(),
        creditInr: z.number().nullable().optional(),
      })
      .parse(request.body);
    const entry = await farmerRoiAdminService.staffEditEntry({
      farmerId: detail.lead.farmerId as string,
      entryId,
      staffEmail: admin.email,
      password: body.password,
      patch: {
        entryDate: body.entryDate,
        category: body.category,
        comments: body.comments,
        debitInr: body.debitInr,
        creditInr: body.creditInr,
      },
    });
    return reply.send({ ok: true, entry });
  });

  app.get(`${api}/leads/:id/crm`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const bundle = await crmFarmerService.getFarmerCrmBundle(
      detail.lead.farmerId as string,
      id,
      admin.email
    );
    return reply.send({ ok: true, ...bundle });
  });

  app.get(`${api}/leads/:id/blocks`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const blocks = await crmFarmerService.ensureDemoBlocks(detail.lead.farmerId as string);
    return reply.send({ ok: true, blocks });
  });

  app.get(`${api}/leads/:leadId/blocks/:blockId/workspace`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { leadId, blockId } = request.params as { leadId: string; blockId: string };
    const detail = await telecallerAdminService.getLeadDetail(leadId);
    const workspace = await crmFarmerService.getBlockWorkspace(
      detail.lead.farmerId as string,
      blockId
    );
    return reply.send({ ok: true, ...workspace });
  });

  app.get(`${api}/leads/:id/interactions`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const q = request.query as { page?: string; limit?: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const result = await crmFarmerService.listHumanCrmInteractions(
      detail.lead.farmerId as string,
      id,
      q.page ? Number(q.page) : 1,
      q.limit ? Number(q.limit) : 40
    );
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/leads/:leadId/interactions/:interactionId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { leadId, interactionId } = request.params as { leadId: string; interactionId: string };
    const detail = await telecallerAdminService.getLeadDetail(leadId);
    const interaction = await crmFarmerService.getHumanCrmInteractionDetail(
      String(detail.lead.farmerId),
      leadId,
      interactionId
    );
    return reply.send({ ok: true, interaction });
  });

  app.get(`${api}/leads/:id/agronomist`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const { telecallerFarmerAgronomistService } = await import(
      '../../services/admin/telecaller-farmer-agronomist.service.js'
    );
    const panel = await telecallerFarmerAgronomistService.getPanel(String(detail.lead.farmerId));
    return reply.send({ ok: true, ...panel });
  });

  app.get(`${api}/leads/:id/recommendations`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const q = request.query as { page?: string; limit?: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const result = await crmFarmerService.listRecommendations(
      detail.lead.farmerId as string,
      q.page ? Number(q.page) : 1,
      q.limit ? Number(q.limit) : 20
    );
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/leads/:id/field-findings`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const q = request.query as { page?: string; limit?: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const result = await telecallerAdminService.listFieldFindings(
      detail.lead.farmerId as string,
      q.page ? Number(q.page) : 1,
      q.limit ? Number(q.limit) : 100
    );
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/leads/:leadId/field-findings/:findingId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { leadId, findingId } = request.params as { leadId: string; findingId: string };
    const detail = await telecallerAdminService.getLeadDetail(leadId);
    const finding = await telecallerAdminService.getFieldFinding(
      String(detail.lead.farmerId),
      findingId
    );
    return reply.send({ ok: true, finding });
  });

  app.patch(`${api}/field-findings/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        observations: z.string().max(4000).optional(),
        diseasePest: z.string().max(500).optional(),
        diseaseTone: z.enum(['healthy', 'warning', 'danger']).optional(),
        actionTaken: z.string().max(2000).optional(),
        followUpAt: z.string().datetime().optional(),
        parameters: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
      })
      .merge(structuredFieldFindingSchema)
      .parse(request.body);
    const finding = await telecallerAdminService.updateFieldFinding(id, {
      observations: body.observations,
      disease_pest: body.diseasePest,
      disease_tone: body.diseaseTone,
      action_taken: body.actionTaken,
      follow_up_at: body.followUpAt,
      parameters: body.parameters,
      finding_type: body.findingType,
      severity: body.severity,
      affected_area_pct: body.affectedAreaPct,
      ai_prediction: body.aiPrediction,
      final_confirmed_issue: body.finalConfirmedIssue,
    });
    return reply.send({ ok: true, finding });
  });

  app.get(`${api}/tasks`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { status?: string };
    const tasks = await telecallerAdminService.listTasks(admin.email, q.status ?? 'pending');
    return reply.send({ ok: true, tasks });
  });

  app.get(`${api}/leads/:id/tasks`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const tasks = await telecallerAdminService.listLeadPendingTasks(id);
    return reply.send({ ok: true, tasks });
  });

  app.get(`${api}/leads/:id/agronomist-tasks`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const tasks = await telecallerAdminService.listLeadAgronomistTasks(id);
    return reply.send({ ok: true, tasks });
  });

  app.get(`${api}/agronomists`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const agronomists = await telecallerAdminService.listAssignableAgronomists();
    return reply.send({ ok: true, agronomists });
  });

  app.get(`${api}/tasks/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getTaskDetail(id);
    return reply.send({ ok: true, ...detail });
  });

  app.post(`${api}/tasks/:id/comments`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        body: z.string().min(1).max(4000),
        authorRole: z.enum(['telecaller', 'agronomist']).optional(),
      })
      .parse(request.body);
    const role = body.authorRole ?? (admin.role === 'agronomist' ? 'agronomist' : 'telecaller');
    const comment = await telecallerAdminService.addTaskComment(id, {
      body: body.body,
      authorEmail: admin.email,
      authorRole: role,
      authorName: (admin as { fullName?: string }).fullName ?? admin.email,
    });
    return reply.status(201).send({ ok: true, comment });
  });

  app.get(`${api}/leads/:id/escalations`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const escalations = await escalationAdminService.listForFarmer(String(detail.lead.farmerId));
    return reply.send({ ok: true, escalations });
  });

  app.get(`${api}/leads/:id/notes`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const result = await telecallerAdminService.listLeadNotes(id);
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/leads/:leadId/notes/:noteId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { leadId, noteId } = request.params as { leadId: string; noteId: string };
    const note = await telecallerAdminService.getLeadNote(leadId, noteId);
    return reply.send({ ok: true, note });
  });

  app.patch(`${api}/leads/:leadId/notes/:noteId`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { leadId, noteId } = request.params as { leadId: string; noteId: string };
    const { note } = z.object({ note: z.string().min(1).max(8000) }).parse(request.body);
    const updated = await telecallerAdminService.updateLeadNote(leadId, noteId, note, admin.email);
    return reply.send({ ok: true, note: updated });
  });

  app.patch(`${api}/tasks/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        notes: z.string().max(2000).optional(),
        dueAt: z.string().datetime().optional(),
        markDone: z.boolean().optional(),
        markPending: z.boolean().optional(),
      })
      .parse(request.body);
    const task = await telecallerAdminService.updateTask(id, body);
    return reply.send({ ok: true, task });
  });

  app.patch(`${api}/tasks/:id/complete`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    await telecallerAdminService.completeTask(id);
    return reply.send({ ok: true });
  });

  app.patch(`${api}/interactions/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        summary: z.string().max(500).optional(),
        content: z.string().max(4000).optional(),
        notes: z.string().max(4000).optional(),
      })
      .parse(request.body);
    const interaction = await crmFarmerService.updateInteraction(id, {
      summary: body.summary,
      content: body.content ?? body.notes,
    });
    return reply.send({ ok: true, interaction });
  });

  app.delete(`${api}/tasks/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const { error } = await supabase
      .from('crm_tasks')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfSupabaseError(error, 'Could not archive task');
    return reply.send({ ok: true });
  });

  app.get(`${api}/whatsapp/threads`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const threads = await telecallerAdminService.listWhatsAppThreads();
    return reply.send({ ok: true, threads });
  });

  app.get(`${api}/whatsapp/:farmerId/messages`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { farmerId } = request.params as { farmerId: string };
    const messages = await telecallerAdminService.getWhatsAppMessages(farmerId);
    return reply.send({ ok: true, messages });
  });

  app.post(`${api}/whatsapp/:farmerId/send`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { farmerId } = request.params as { farmerId: string };
    const { text } = z.object({ text: z.string().min(1).max(4096) }).parse(request.body);
    const result = await telecallerAdminService.sendWhatsAppMessage(
      farmerId,
      text,
      admin.email
    );
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/whatsapp/:farmerId/session`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { farmerId } = request.params as { farmerId: string };
    const session = await whatsappOsAdminService.getConversationSession(farmerId);
    return reply.send({ ok: true, session });
  });

  app.patch(`${api}/whatsapp/:farmerId/session`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { farmerId } = request.params as { farmerId: string };
    const body = z
      .object({
        aiPaused: z.boolean().optional(),
        owner: z.enum(['ai', 'telecaller', 'agronomist']).optional(),
        preferredLanguage: z.enum(['en', 'ml', 'ta', 'kn', 'hi']).nullable().optional(),
        activeBlockId: z.string().uuid().nullable().optional(),
      })
      .parse(request.body);
    const session = await whatsappOsAdminService.updateConversationSession(farmerId, {
      ...body,
      activePlotId: body.activeBlockId,
    });
    return reply.send({ ok: true, session });
  });

  app.post(`${api}/leads`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const body = z
      .object({
        phone: z.string().min(10),
        name: z.string().optional(),
        notes: z.string().optional(),
        cropType: z.string().optional(),
        district: z.string().optional(),
        state: z.string().optional(),
        whatsappSame: z.boolean().optional(),
        whatsappPhone: z.string().optional(),
        language: z.string().optional(),
        pincode: z.string().optional(),
        village: z.string().optional(),
        totalAcreage: z.number().optional(),
        shippingAddress: z.string().optional(),
        deliveryPincode: z.string().optional(),
        assignedCropAdvisor: z.string().optional(),
        roiEnabled: z.boolean().optional(),
        farmerNotes: z.string().optional(),
        cropExperienceYears: z.number().int().min(0).max(60).optional(),
        preferredMarkets: z
          .array(
            z.object({
              marketKey: z.string().min(1),
              cropType: z.string().min(1).optional(),
            })
          )
          .optional(),
        cropBlocks: z
          .array(
            z.object({
              blockName: z.string().optional(),
              cropName: z.string(),
              acreage: z.number().optional(),
              plantingDate: z.string().optional(),
              latitude: z.number().min(6).max(37.5).optional(),
              longitude: z.number().min(68).max(97.5).optional(),
            })
          )
          .optional(),
        leadChannel: z
          .enum(['meta', 'instagram', 'google', 'referral', 'organic', 'whatsapp', 'field', 'other'])
          .optional(),
        campaignSource: z.string().optional(),
        marketingOwnerId: z.string().uuid().nullable().optional(),
        marketingOwnerName: z.string().optional(),
        utmCampaign: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.createLead(body, admin.email);
    return reply.status(201).send({ ok: true, lead: detail.lead, farmerId: detail.lead.farmerId });
  });

  app.delete(`${api}/leads/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const { farmerPurgeService } = await import('../../services/farmer/farmer-purge.service.js');
    const result = await farmerPurgeService.purgeByLeadId(id);
    if (!result.ok) {
      return reply.code(404).send({ ok: false, error: 'Lead not found' });
    }
    return reply.send({
      ok: true,
      deletedLeadId: id,
      purgedFarmerId: result.farmerId,
      phone: result.phone,
    });
  });

  app.post(`${api}/leads/:id/calls`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        outcome: callOutcomeEnum.optional(),
        notes: z.string().optional(),
        durationSeconds: z.number().int().optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.logCall(id, body, admin.email);
    return reply.send({ ok: true, ...detail });
  });

  app.post(`${api}/leads/:id/calls/upload`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        audioBase64: z.string().optional(),
        filename: z.string().optional(),
        mimeType: z.string().optional(),
        transcript: z.string().optional(),
        outcome: callOutcomeEnum.optional(),
        durationSeconds: z.number().int().optional(),
        recordingProvider: z.enum(['app_upload', 'voice_note', 'exotel']).optional(),
      })
      .parse(request.body);
    const { callIntelligenceService } = await import(
      '../../services/call-intelligence/call-intelligence.service.js'
    );
    const result = await callIntelligenceService.uploadAndProcess({
      leadId: id,
      agentEmail: admin.email,
      ...body,
    });
    return reply.status(201).send({ ok: true, call: result.call });
  });

  app.get(`${api}/calls/:callId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { callId } = request.params as { callId: string };
    const { callIntelligenceService } = await import(
      '../../services/call-intelligence/call-intelligence.service.js'
    );
    const call = await callIntelligenceService.getCall(callId);
    return reply.send({ ok: true, call });
  });

  app.post(`${api}/calls/:callId/reprocess`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { callId } = request.params as { callId: string };
    const { callIntelligenceService } = await import(
      '../../services/call-intelligence/call-intelligence.service.js'
    );
    const result = await callIntelligenceService.processCall(callId);
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/calls/:callId/confirm`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { callId } = request.params as { callId: string };
    const body = z
      .object({
        acceptStage: z.boolean().optional(),
        stage: leadStageEnum.optional(),
      })
      .parse(request.body ?? {});
    const { callIntelligenceService } = await import(
      '../../services/call-intelligence/call-intelligence.service.js'
    );
    const result = await callIntelligenceService.confirmCall(callId, {
      ...body,
      agentEmail: admin.email,
    });
    return reply.send(result);
  });

  app.post(`${api}/calls/:callId/diagnosis`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { callId } = request.params as { callId: string };
    const body = z
      .object({
        imageBase64: z.string().optional(),
        imageMimeType: z.string().optional(),
      })
      .parse(request.body ?? {});
    const { callIntelligenceService } = await import(
      '../../services/call-intelligence/call-intelligence.service.js'
    );
    const diagnosis = await callIntelligenceService.runDiagnosis(callId, body);
    return reply.send({ ok: true, diagnosis });
  });

  app.get(`${api}/leads/:id/timeline`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const { callIntelligenceService } = await import(
      '../../services/call-intelligence/call-intelligence.service.js'
    );
    const timeline = await callIntelligenceService.getLeadTimeline(id);
    return reply.send({ ok: true, ...timeline });
  });

  app.get(`${api}/qc/overview`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { days?: string; agentEmail?: string };
    const { callQcService } = await import('../../services/call-intelligence/call-qc.service.js');
    const days = q.days ? Number(q.days) : 7;
    const overview = await callQcService.getOverview(days, q.agentEmail);
    return reply.send({ ok: true, overview });
  });

  app.get(`${api}/qc/flagged`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { days?: string };
    const { callQcService } = await import('../../services/call-intelligence/call-qc.service.js');
    const calls = await callQcService.listFlaggedCalls(q.days ? Number(q.days) : 7);
    return reply.send({ ok: true, calls });
  });

  app.get(`${api}/mobile/dashboard`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { telecallerMobileService } = await import(
      '../../services/call-intelligence/telecaller-mobile.service.js'
    );
    const dashboard = await telecallerMobileService.getDashboard(admin.email);
    return reply.send({ ok: true, ...dashboard });
  });

  app.get(`${api}/mobile/leads`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { scope?: string; limit?: string };
    const { telecallerMobileService } = await import(
      '../../services/call-intelligence/telecaller-mobile.service.js'
    );
    const leads = await telecallerMobileService.listLeads(admin.email, {
      scope: q.scope === 'all' ? 'all' : 'mine',
      limit: q.limit ? Number(q.limit) : 40,
    });
    return reply.send({ ok: true, leads });
  });

  app.get(`${api}/mobile/follow-ups`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { status?: string; grouped?: string };
    const { telecallerMobileService } = await import(
      '../../services/call-intelligence/telecaller-mobile.service.js'
    );
    if (q.grouped === 'true' || q.grouped === '1') {
      const sections = await telecallerMobileService.listFollowUpSections(admin.email);
      return reply.send({ ok: true, sections });
    }
    const tasks = await telecallerMobileService.listFollowUps(admin.email, q.status ?? 'pending');
    return reply.send({ ok: true, tasks });
  });

  app.get(`${api}/mobile/leads/operational`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as {
      scope?: string;
      search?: string;
      smartFilter?: string;
      sort?: string;
      limit?: string;
    };
    const { telecallerMobileService } = await import(
      '../../services/call-intelligence/telecaller-mobile.service.js'
    );
    const leads = await telecallerMobileService.listOperationalLeads(admin.email, {
      scope: q.scope === 'all' ? 'all' : 'mine',
      search: q.search,
      smartFilter: q.smartFilter,
      sort: q.sort,
      limit: q.limit ? Number(q.limit) : 50,
    });
    return reply.send({ ok: true, leads });
  });

  app.get(`${api}/mobile/leads/:id/workspace-summary`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const { telecallerMobileService } = await import(
      '../../services/call-intelligence/telecaller-mobile.service.js'
    );
    const summary = await telecallerMobileService.getWorkspaceSummary(id);
    return reply.send({ ok: true, summary });
  });

  app.get(`${api}/mobile/notifications`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { telecallerMobileService } = await import(
      '../../services/call-intelligence/telecaller-mobile.service.js'
    );
    const notifications = await telecallerMobileService.listNotifications(admin.email);
    return reply.send({ ok: true, notifications });
  });

  app.get(`${api}/mobile/sales-opportunities`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { salesOpportunityService } = await import(
      '../../services/partner/sales-opportunity.service.js'
    );
    const opportunities = await salesOpportunityService.listForTelecaller(admin.email);
    return reply.send({ ok: true, opportunities });
  });

  app.patch(`${api}/sales-opportunities/:id`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z.enum([
          'interested',
          'hot_lead',
          'ready_to_order',
          'follow_up_required',
          'converted',
          'closed',
        ]),
      })
      .parse(request.body);
    const { salesOpportunityService } = await import(
      '../../services/partner/sales-opportunity.service.js'
    );
    const opportunity = await salesOpportunityService.updateStatus(id, body.status, admin.email);
    return reply.send({ ok: true, opportunity });
  });

  app.get(`${api}/leads/:id/team-timeline`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const { farmerTeamTimelineService } = await import(
      '../../services/crm/farmer-team-timeline.service.js'
    );
    const timeline = await farmerTeamTimelineService.listForFarmer(String(detail.lead.farmerId));
    return reply.send({ ok: true, timeline });
  });

  app.post(`${api}/leads/:id/team-timeline`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ body: z.string().min(1).max(8000) }).parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const { farmerTeamTimelineService } = await import(
      '../../services/crm/farmer-team-timeline.service.js'
    );
    const entry = await farmerTeamTimelineService.addComment({
      farmerId: String(detail.lead.farmerId),
      body: body.body,
      authorType: 'telecaller',
      authorEmail: admin.email,
      authorName: admin.email,
    });
    return reply.send({ ok: true, entry });
  });

  app.post(`${api}/exotel/click-to-call`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const body = z
      .object({ leadId: z.string().uuid(), farmerPhone: z.string().min(10) })
      .parse(request.body);
    const { exotelService } = await import('../../services/call-intelligence/exotel.service.js');
    const result = await exotelService.initiateClickToCall({
      leadId: body.leadId,
      farmerPhone: body.farmerPhone,
      agentEmail: admin.email,
    });
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/leads/:id/tasks`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        title: z.string().min(1),
        dueAt: z.string().optional(),
        notes: z.string().optional(),
        taskType: z.string().optional(),
        blockId: z.string().uuid().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assignedAgronomist: z.string().email().optional(),
        issueDescription: z.string().max(2000).optional(),
        taskCategory: z
          .enum([
            'call_farmer',
            'visit_request',
            'recommendation',
            'soil_test_review',
            'disease_review',
            'other',
          ])
          .optional(),
        initialComment: z.string().max(4000).optional(),
      })
      .parse(request.body);
    const task = await telecallerAdminService.createTask(id, body, admin.email);
    return reply.send({ ok: true, task });
  });

  app.post(`${api}/leads/:id/blocks`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1),
        area: z.string().optional(),
        cropId: z.string().uuid().optional(),
        cropName: z.string().optional(),
        varietyName: z.string().optional(),
        irrigationTypeId: z.string().uuid().optional(),
        soilTypeId: z.string().uuid().optional(),
        plantingDate: z.string().optional(),
        spacing: z.string().optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const block = await crmFarmerService.createBlock(detail.lead.farmerId as string, body);
    return reply.status(201).send({ ok: true, block });
  });

  app.patch(`${api}/leads/:leadId/blocks/:blockId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { leadId, blockId } = request.params as { leadId: string; blockId: string };
    const body = z
      .object({
        name: z.string().optional(),
        area: z.string().optional(),
        cropName: z.string().optional(),
        plantingDate: z.string().optional(),
        latitude: z.number().min(6).max(37.5).optional(),
        longitude: z.number().min(68).max(97.5).optional(),
        location_source: z.enum(['field_pwa', 'telecaller', 'whatsapp', 'api']).optional(),
      })
      .parse(request.body);

    const detail = await telecallerAdminService.getLeadDetail(leadId);
    const farmerId = detail.lead.farmerId as string;

    if (body.latitude !== undefined && body.longitude !== undefined) {
      const { plotLocationService } = await import('../../services/core/plot-location.service.js');
      await plotLocationService.updateBlockLocation(blockId, {
        latitude: body.latitude,
        longitude: body.longitude,
        source: body.location_source ?? 'telecaller',
        farmerId,
      });
    }

    const patch: Record<string, unknown> = {};
    if (body.name != null) {
      patch.name = body.name;
      patch.plot_label = body.name;
    }
    if (body.area != null) patch.area = body.area;
    if (body.cropName != null) {
      patch.crop_name = body.cropName;
      patch.crop_type = body.cropName.trim().toLowerCase().replace(/\s+/g, '_');
    }
    if (body.plantingDate != null) patch.planting_date = body.plantingDate;
    const block = await crmFarmerService.updateBlock(blockId, patch);
    return reply.send({ ok: true, block });
  });

  app.post(`${api}/leads/:id/soil-reports`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        blockId: z.string().uuid().optional(),
        metrics: z.record(z.unknown()).optional(),
        pdfUrl: z.string().optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const report = await crmFarmerService.createSoilReport(detail.lead.farmerId as string, {
      blockId: body.blockId,
      metrics: body.metrics,
      pdfUrl: body.pdfUrl,
      uploadedBy: admin.email,
    });
    return reply.status(201).send({ ok: true, report });
  });

  app.delete(`${api}/leads/:leadId/blocks/:blockId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { blockId } = request.params as { leadId: string; blockId: string };
    const block = await crmFarmerService.updateBlock(blockId, { archived: true });
    return reply.send({ ok: true, block });
  });

  app.post(`${api}/leads/:id/interactions`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        interactionType: z.string().min(1),
        blockId: z.string().uuid().optional(),
        summary: z.string().min(1),
        notes: z.string().optional(),
        interactionAt: z.string().optional(),
        outcome: z.string().optional(),
        nextAction: z.string().optional(),
        nextActionAt: z.string().optional(),
        workflowStatus: z.enum(['Active', 'Closed', 'Escalated']).optional(),
        addFieldFinding: z.boolean().optional(),
        fieldActivityLabel: z.string().optional(),
        fieldActivityTypeId: z.string().uuid().optional(),
        fieldActivityDate: z.string().optional(),
        addFieldActivity: z.boolean().optional(),
        recommendationSummary: z.string().optional(),
        recommendationCompleted: z.boolean().optional(),
        escalate: z.boolean().optional(),
        status: z.string().optional(),
      })
      .merge(structuredFieldFindingSchema)
      .superRefine((data, ctx) => {
        if (!data.addFieldFinding) return;
        if (!data.blockId) {
          ctx.addIssue({ code: 'custom', message: 'Block is required for field finding', path: ['blockId'] });
        }
        if (!data.findingType) {
          ctx.addIssue({ code: 'custom', message: 'Finding type is required', path: ['findingType'] });
        }
        if (!data.severity) {
          ctx.addIssue({ code: 'custom', message: 'Severity is required', path: ['severity'] });
        }
        if (!data.finalConfirmedIssue?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'Confirmed issue is required',
            path: ['finalConfirmedIssue'],
          });
        }
      })
      .parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const interaction = await crmFarmerService.createInteraction(
      detail.lead.farmerId as string,
      id,
      { ...body, doneBy: admin.email, doneByRole: 'Telecaller' }
    );
    return reply.status(201).send({ ok: true, interaction });
  });

  app.delete(`${api}/interactions/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const { error } = await supabase
      .from('interaction_logs')
      .update({ status: 'archived' })
      .eq('id', id);
    throwIfSupabaseError(error, 'Could not archive interaction');
    return reply.send({ ok: true });
  });

  app.post(`${api}/leads/:id/recommendations`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        blockId: z.string().uuid().optional(),
        recType: z.enum(['ai', 'agronomist', 'spray', 'drench']).optional(),
        problem: z.string().optional(),
        recommendation: z.string().min(1),
        dosage: z.string().optional(),
        applicationMethod: z.string().optional(),
        followUpAt: z.string().optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const rec = await crmFarmerService.createRecommendation(detail.lead.farmerId as string, id, {
      ...body,
      recommendedBy: admin.email,
    });
    return reply.status(201).send({ ok: true, recommendation: rec });
  });

  app.delete(`${api}/recommendations/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const { error } = await supabase
      .from('crm_recommendations')
      .update({ status: 'archived' })
      .eq('id', id);
    throwIfSupabaseError(error, 'Could not archive recommendation');
    return reply.send({ ok: true });
  });

  app.post(`${api}/leads/:id/field-findings`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        blockId: z.string().uuid().optional(),
        blockName: z.string().min(1),
        cropType: z.string().min(1),
        observations: z.string().optional(),
        diseasePest: z.string().optional(),
        diseaseTone: z.enum(['healthy', 'warning', 'danger']).optional(),
        actionTaken: z.string().optional(),
        parameters: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
      })
      .merge(structuredFieldFindingSchema)
      .superRefine((data, ctx) => {
        if (!data.findingType) {
          ctx.addIssue({ code: 'custom', message: 'Finding type is required', path: ['findingType'] });
        }
        if (!data.severity) {
          ctx.addIssue({ code: 'custom', message: 'Severity is required', path: ['severity'] });
        }
        if (!data.finalConfirmedIssue?.trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'Confirmed issue is required',
            path: ['finalConfirmedIssue'],
          });
        }
      })
      .parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const finding = await telecallerAdminService.createFieldFinding(
      detail.lead.farmerId as string,
      id,
      body
    );
    return reply.status(201).send({ ok: true, finding });
  });

  app.delete(`${api}/field-findings/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const { error } = await supabase
      .from('crm_field_findings')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    throwIfSupabaseError(error, 'Could not archive field finding');
    return reply.send({ ok: true });
  });

  app.post(`${api}/leads/:id/schedule-visit`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        title: z.string().optional(),
        dueAt: z.string(),
        notes: z.string().optional(),
        blockId: z.string().uuid().optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const result = await crmFarmerService.scheduleVisit(detail.lead.farmerId as string, id, {
      ...body,
      assignedTo: admin.email,
      createdBy: admin.email,
    });
    return reply.status(201).send({ ok: true, ...result });
  });

  app.get(`${api}/leads/:id/estimates`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const estimates = await commerceQuoteService.listByLead(id);
    return reply.send({
      ok: true,
      estimates: estimates.map((e) => ({
        id: e.id,
        quotationId: e.quoteNumber,
        status: e.status,
        amount: e.total,
        prepaidAmount: e.prepaidAmount,
        codAmount: e.codAmount,
        paymentType: e.paymentType,
        preparedByName: e.preparedByName,
        sentAt: e.sentAt,
        whatsappSentAt: e.whatsappSentAt,
        emailSentAt: e.emailSentAt,
        createdAt: e.createdAt,
        expiresAt: e.expiresAt,
        hoursLeft: e.hoursLeft,
        bulkMarginReviewStatus: e.bulkMarginReviewStatus ?? null,
      })),
    });
  });

  app.get(`${api}/leads/:leadId/estimates/:estimateId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { leadId, estimateId } = request.params as { leadId: string; estimateId: string };
    const detail = await commerceQuoteService.getEstimateDetail(estimateId, leadId);
    return reply.send({ ok: true, ...detail });
  });

  app.post(`${api}/leads/:id/estimates`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        prepaidAmount: z.coerce.number().min(0).optional(),
        paymentType: z.enum(['full', 'partial', 'advance']).optional(),
        preparedByName: z.string().optional(),
        send: z.boolean().optional(),
        sendChannels: z.array(z.enum(['whatsapp', 'email'])).optional(),
        orderType: z.enum(['standard', 'bulk', 'clearance', 'strategic', 'liquidation']).optional(),
        requestBulkReview: z.boolean().optional(),
        lines: z
          .array(
            z.object({
              variantId: z.coerce.number().optional(),
              productId: z.coerce.number().optional(),
              sku: z.string().optional(),
              title: z.string().min(1),
              variantTitle: z.string().optional(),
              hsnCode: z.string().optional(),
              qty: z.coerce.number().int().positive(),
              unitPrice: z.coerce.number().positive(),
              gstPercent: z.coerce.number().optional(),
            })
          )
          .min(1),
      })
      .parse(request.body);
    const quote = await commerceQuoteService.createFromLead(id, body, admin.id);
    let sendResult = null;
    if (body.send) {
      const channels = body.sendChannels?.length ? body.sendChannels : (['whatsapp'] as const);
      sendResult = await commerceQuoteService.sendQuote(
        quote.id,
        id,
        [...channels],
        admin.email
      );
    }
    return reply.status(201).send({ ok: true, estimate: quote, send: sendResult });
  });

  app.put(`${api}/leads/:leadId/estimates/:estimateId`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { leadId, estimateId } = request.params as { leadId: string; estimateId: string };
    const body = z
      .object({
        prepaidAmount: z.coerce.number().min(0).optional(),
        paymentType: z.enum(['full', 'partial', 'advance']).optional(),
        preparedByName: z.string().optional(),
        send: z.boolean().optional(),
        sendChannels: z.array(z.enum(['whatsapp', 'email'])).optional(),
        orderType: z.enum(['standard', 'bulk', 'clearance', 'strategic', 'liquidation']).optional(),
        requestBulkReview: z.boolean().optional(),
        lines: z
          .array(
            z.object({
              variantId: z.coerce.number().optional(),
              productId: z.coerce.number().optional(),
              sku: z.string().optional(),
              title: z.string().min(1),
              variantTitle: z.string().optional(),
              hsnCode: z.string().optional(),
              qty: z.coerce.number().int().positive(),
              unitPrice: z.coerce.number().positive(),
              gstPercent: z.coerce.number().optional(),
            })
          )
          .min(1),
      })
      .parse(request.body);
    const quote = await commerceQuoteService.updateFromLead(estimateId, leadId, body, admin.id);
    let sendResult = null;
    if (body.send) {
      const channels = body.sendChannels?.length ? body.sendChannels : (['whatsapp'] as const);
      sendResult = await commerceQuoteService.sendQuote(
        quote.id,
        leadId,
        [...channels],
        admin.email
      );
    }
    return reply.send({ ok: true, estimate: quote, send: sendResult });
  });

  app.post(`${api}/leads/:leadId/estimates/:estimateId/send`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { leadId, estimateId } = request.params as { leadId: string; estimateId: string };
    const body = z
      .object({
        channels: z.array(z.enum(['whatsapp', 'email'])).min(1),
      })
      .parse(request.body);
    const result = await commerceQuoteService.sendQuote(
      estimateId,
      leadId,
      body.channels,
      admin.email
    );
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/leads/:leadId/estimates/:estimateId/confirm-cod`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { estimateId } = request.params as { leadId: string; estimateId: string };
    const result = await commerceQuoteService.confirmCodOrder(estimateId, admin.email);
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/leads/:leadId/estimates/:estimateId/share`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { leadId, estimateId } = request.params as { leadId: string; estimateId: string };
    const links = await commerceQuoteService.getShareLinks(estimateId, leadId);
    return reply.send({ ok: true, ...links });
  });

  app.delete(`${api}/leads/:leadId/estimates/:estimateId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { leadId, estimateId } = request.params as { leadId: string; estimateId: string };
    await commerceQuoteService.deleteFromLead(estimateId, leadId);
    return reply.send({ ok: true });
  });

  app.get(`${api}/leads/:id/orders`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const result = await crmFarmerService.listFarmerOrders(detail.lead.farmerId as string);
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/leads/:leadId/orders/:orderId`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { leadId, orderId } = request.params as { leadId: string; orderId: string };
    const detail = await telecallerAdminService.getLeadDetail(leadId);
    const order = await crmFarmerService.getFarmerOrderDetail(
      String(detail.lead.farmerId),
      orderId
    );
    return reply.send({ ok: true, order });
  });

  app.get(`${api}/orders/catalog`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { search?: string };
    const items = await crmFarmerService.getOrderCatalog(q.search);
    return reply.send({ ok: true, items });
  });

  app.post(`${api}/leads/:id/orders`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        blockId: z.string().uuid().optional(),
        lineItems: z.array(
          z.object({
            variantId: z.number().optional(),
            title: z.string(),
            quantity: z.number().min(1),
            price: z.number().min(0),
          })
        ),
        paymentMode: z.string().optional(),
        deliveryAddress: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const order = await crmFarmerService.createManualOrder(detail.lead.farmerId as string, id, {
      ...body,
      createdBy: admin.email,
    });
    return reply.status(201).send({ ok: true, order });
  });

  app.post(`${api}/leads/:id/orders/:orderId/push-to-oms`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { orderId } = request.params as { id: string; orderId: string };
    const { manualOrderOmsService } = await import('../../services/oms/manual-order-oms.service.js');
    const result = await manualOrderOmsService.pushToOms(orderId, admin.email);
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/leads/:id/recommendations/:recId/convert-order`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id, recId } = request.params as { id: string; recId: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const order = await crmFarmerService.convertRecommendationToOrder(
      recId,
      detail.lead.farmerId as string,
      id,
      admin.email
    );
    return reply.status(201).send({ ok: true, order });
  });

  app.get(`${api}/masters`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { type?: string; parentId?: string; search?: string };
    const type = z.string().min(1).parse(q.type ?? 'crop') as MasterType;
    const items = await crmFarmerService.listMasters(type, q.parentId || null, q.search);
    return reply.send({ ok: true, items });
  });

  app.get(`${api}/market-options`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { cropType?: string };
    const rows = await whatsappOsAdminService.listMarketOptions(q.cropType);
    const options = rows.map((row) => {
      const district = row.district ? String(row.district).trim() : '';
      const marketName = String(row.market_name).trim();
      return {
        id: row.id ? String(row.id) : undefined,
        marketKey: district ? `${marketName}|${district}` : marketName,
        marketLabel: district ? `${marketName} (${district})` : marketName,
      };
    });
    return reply.send({ ok: true, options });
  });

  app.post(`${api}/masters`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const body = z
      .object({
        masterType: z.string().min(1),
        name: z.string().min(1).max(120),
        parentId: z.string().uuid().nullable().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
      })
      .parse(request.body);
    const item = await crmFarmerService.createMaster({
      masterType: body.masterType as MasterType,
      name: body.name,
      parentId: body.parentId,
      category: body.category,
      description: body.description,
    });
    return reply.status(201).send({ ok: true, item });
  });

  app.patch(`${api}/masters/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        category: z.string().max(120).nullable().optional(),
        description: z.string().optional(),
        active: z.boolean().optional(),
        confirmPassword: confirmPasswordSchema,
      })
      .parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertSuperAdminPasswordConfirm(actor, confirmPassword);
    const item = await crmFarmerService.updateMaster(id, patch);
    return reply.send({ ok: true, item });
  });

  app.delete(`${api}/masters/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    const item = await crmFarmerService.updateMaster(id, { active: false });
    return reply.send({ ok: true, item });
  });

  app.get(`${api}/leads/:id/export`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const q = request.query as { type?: string };
    const type = (q.type ?? 'lead') as 'lead' | 'recommendations' | 'findings' | 'interactions';
    const detail = await telecallerAdminService.getLeadDetail(id);
    const farmerId = detail.lead.farmerId as string;
    let html = '';
    if (type === 'lead') {
      html = crmFarmerService.buildExportHtml('lead', {
        title: `Farmer — ${detail.lead.farmerName}`,
        rows: [
          { label: 'Name', value: String(detail.lead.farmerName) },
          { label: 'Phone', value: String(detail.lead.phone ?? '') },
          { label: 'Stage', value: String(detail.lead.stageLabel ?? detail.lead.stage) },
          { label: 'District', value: String(detail.lead.district ?? '') },
        ],
      });
    } else if (type === 'recommendations') {
      const recs = await crmFarmerService.listRecommendations(farmerId, 1, 50);
      html = crmFarmerService.buildExportHtml('recommendations', {
        title: `Recommendations — ${detail.lead.farmerName}`,
        table: {
          cols: ['Date', 'Block', 'Problem', 'Recommendation', 'Status'],
          rows: recs.recommendations.map((r) => [
            r.dateLabel ?? '',
            r.blockName ?? '',
            r.problem ?? '',
            r.recommendation ?? '',
            r.status ?? '',
          ]),
        },
      });
    } else if (type === 'interactions') {
      const ix = await crmFarmerService.listInteractions(farmerId, 1, 50);
      html = crmFarmerService.buildExportHtml('interactions', {
        title: `Interactions — ${detail.lead.farmerName}`,
        table: {
          cols: ['Date', 'Type', 'By', 'Summary', 'Status'],
          rows: ix.interactions.map((i) => [
            i.atLabel ?? '',
            i.typeLabel ?? '',
            i.by ?? '',
            String(i.summary ?? '').slice(0, 80),
            i.status ?? '',
          ]),
        },
      });
    } else {
      const ff = await telecallerAdminService.listFieldFindings(farmerId, 1, 50);
      html = crmFarmerService.buildExportHtml('findings', {
        title: `Field Findings — ${detail.lead.farmerName}`,
        table: {
          cols: ['Date', 'Block', 'Agronomist', 'Observations', 'Disease'],
          rows: ff.findings.map((f) => [
            f.visitedLabel ?? '',
            f.blockName ?? '',
            f.agronomistName ?? '',
            String(f.observations ?? '').slice(0, 80),
            f.diseasePest ?? '',
          ]),
        },
      });
    }
    return reply.send({ ok: true, html, filename: `morbeez-${type}-${id.slice(0, 8)}.html` });
  });

  app.get(`${api}/leads/:id/share`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const q = request.query as { type?: string; recId?: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const phone = String(detail.lead.phone ?? '');
    if (q.type === 'recommendation' && q.recId) {
      const { data } = await supabase.from('crm_recommendations').select('*').eq('id', q.recId).single();
      const share = crmFarmerService.buildWhatsAppMessage(
        'recommendation',
        {
          problem: data?.problem,
          recommendation: data?.recommendation,
          dosage: data?.dosage,
        },
        phone
      );
      return reply.send({ ok: true, ...share });
    }
    const share = crmFarmerService.buildWhatsAppMessage(
      'lead',
      {
        name: detail.lead.farmerName,
        phone,
        crop: detail.farmer?.crop,
        territory: detail.farmer?.territory,
      },
      phone
    );
    return reply.send({ ok: true, ...share });
  });

  app.get(`${api}/escalations`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { status?: string; page?: string; limit?: string };
    const result = await escalationAdminService.list({
      status: q.status ?? 'open',
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 50,
    });
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/escalations/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const escalation = await escalationAdminService.getById(id);
    return reply.send({ ok: true, escalation });
  });

  app.patch(`${api}/escalations/:id`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z.enum(['pending', 'assigned', 'in_review', 'resolved', 'closed']).optional(),
        workflowStatus: z.enum(['pending', 'agronomist_review', 'completed']).optional(),
        assignedTo: z.string().optional(),
        agronomistNotes: z.string().max(5000).optional(),
        comment: z.string().max(2000).optional(),
        commentRole: z.enum(['telecaller', 'agronomist']).optional(),
        resolution: z.string().max(2000).optional(),
        correction: z.record(z.unknown()).optional(),
      })
      .parse(request.body);
    const escalation = await escalationAdminService.update(id, body, admin.email);
    return reply.send({ ok: true, escalation });
  });

  app.post(`${api}/escalations/clear-completed`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const result = await escalationAdminService.clearCompleted(admin.email);
    return reply.send(result);
  });

  app.post(`${api}/escalations/:id/clear`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const result = await escalationAdminService.clear(id, admin.email);
    return reply.send(result);
  });

  app.get(`${api}/leads/:id/field-activities/blocks`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const detail = await telecallerAdminService.getLeadDetail(id);
    const blocks = await whatsappOsAdminService.listFieldActivityBlocksForFarmer(
      String(detail.lead.farmerId)
    );
    return reply.send({ ok: true, blocks });
  });

  app.get(`${api}/leads/:id/field-activities`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const { id } = request.params as { id: string };
    const q = z
      .object({
        blockId: z.string().uuid(),
        limit: z.coerce.number().int().positive().max(300).optional(),
      })
      .parse(request.query ?? {});
    const detail = await telecallerAdminService.getLeadDetail(id);
    const farmerId = String(detail.lead.farmerId);
    await whatsappOsAdminService.assertFarmBlockBelongsToFarmer(q.blockId, farmerId);
    const activities = await whatsappOsAdminService.listFieldActivities({
      blockId: q.blockId,
      limit: q.limit,
    });
    return reply.send({ ok: true, activities });
  });

  app.get(`${api}/leads/:id/field-activity-types`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = z
      .object({
        cropType: z.string().optional(),
        activeOnly: z.coerce.boolean().optional(),
      })
      .parse(request.query ?? {});
    const types = await whatsappOsAdminService.listFieldActivityTypes({
      cropType: q.cropType,
      activeOnly: q.activeOnly,
    });
    return reply.send({ ok: true, types });
  });

  app.post(`${api}/leads/:id/field-activity-types`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'write');
    const body = z
      .object({
        activityName: z.string().min(1).max(120),
        category: z.string().max(40).optional(),
        crop: z.string().max(40).nullable().optional(),
        icon: z.string().max(40).nullable().optional(),
        colorTag: z.string().max(40).nullable().optional(),
        followupDefaultDays: z.number().int().min(0).max(365).nullable().optional(),
      })
      .parse(request.body);
    const type = await whatsappOsAdminService.createFieldActivityType(body);
    return reply.status(201).send({ ok: true, type });
  });

  app.patch(`${api}/leads/:id/field-activity-types/:typeId`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { typeId } = request.params as { id: string; typeId: string };
    const body = z
      .object({
        activityName: z.string().min(1).max(120).optional(),
        category: z.string().max(40).optional(),
        crop: z.string().max(40).nullable().optional(),
        confirmPassword: confirmPasswordSchema,
      })
      .parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertSuperAdminPasswordConfirm(actor, confirmPassword);
    const type = await whatsappOsAdminService.updateFieldActivityType(typeId, patch);
    return reply.send({ ok: true, type });
  });

  app.delete(`${api}/leads/:id/field-activity-types/:typeId`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { typeId } = request.params as { id: string; typeId: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    const type = await whatsappOsAdminService.deleteFieldActivityType(typeId);
    return reply.send({ ok: true, type });
  });

  app.post(`${api}/leads/:id/field-activities`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        blockId: z.string().uuid(),
        activityTypeId: z.string().uuid().optional(),
        activityType: z.enum(['spray_applied', 'fertigation', 'drench', 'scouting', 'other']),
        activityLabel: z.string().max(120).optional(),
        activityDate: z.string().min(8).max(20),
        dap: z.number().int().min(0).max(5000).optional(),
        notes: z.string().max(1000).optional(),
        costInr: z.number().min(0).max(10000000).optional(),
        costBreakdown: z
          .object({
            labourCostInr: z.number().min(0).max(10000000).optional(),
            sprayCostInr: z.number().min(0).max(10000000).optional(),
            fertilizerCostInr: z.number().min(0).max(10000000).optional(),
            machineryCostInr: z.number().min(0).max(10000000).optional(),
          })
          .optional(),
        followUpRequired: z.boolean().optional(),
        followUpDate: z.string().min(8).max(20).optional(),
        status: z.enum(['completed', 'pending', 'cancelled']).optional(),
        assignedEmployee: z.string().max(160).optional(),
      })
      .parse(request.body);
    const detail = await telecallerAdminService.getLeadDetail(id);
    const farmerId = String(detail.lead.farmerId);
    await whatsappOsAdminService.assertFarmBlockBelongsToFarmer(body.blockId, farmerId);
    const activity = await whatsappOsAdminService.createFieldActivity({
      ...body,
      assignedEmployee: body.assignedEmployee ?? admin.email,
    });
    return reply.status(201).send({ ok: true, activity });
  });

  const fieldActivityPatchBody = z.object({
    activityTypeId: z.string().uuid().optional(),
    activityType: z.enum(['spray_applied', 'fertigation', 'drench', 'scouting', 'other']),
    activityLabel: z.string().max(120).optional(),
    activityDate: z.string().min(8).max(20),
    dap: z.number().int().min(0).max(5000).optional(),
    notes: z.string().max(1000).optional(),
    costInr: z.number().min(0).max(10000000).optional(),
    costBreakdown: z
      .object({
        labourCostInr: z.number().min(0).max(10000000).optional(),
        sprayCostInr: z.number().min(0).max(10000000).optional(),
        fertilizerCostInr: z.number().min(0).max(10000000).optional(),
        machineryCostInr: z.number().min(0).max(10000000).optional(),
      })
      .optional(),
    followUpRequired: z.boolean().optional(),
    followUpDate: z.string().min(8).max(20).optional(),
    status: z.enum(['completed', 'pending', 'cancelled']).optional(),
    confirmPassword: confirmPasswordSchema,
  });

  app.patch(`${api}/leads/:id/field-activities/:activityId`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id, activityId } = request.params as { id: string; activityId: string };
    const body = fieldActivityPatchBody.parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertAdminPasswordConfirm(actor, confirmPassword);
    const detail = await telecallerAdminService.getLeadDetail(id);
    await whatsappOsAdminService.assertFieldActivityBelongsToFarmer(
      activityId,
      String(detail.lead.farmerId)
    );
    const activity = await whatsappOsAdminService.updateFieldActivity(activityId, patch);
    return reply.send({ ok: true, activity });
  });

  app.delete(`${api}/leads/:id/field-activities/:activityId`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'telecaller_crm', 'write');
    const { id, activityId } = request.params as { id: string; activityId: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertAdminPasswordConfirm(actor, body.confirmPassword);
    const detail = await telecallerAdminService.getLeadDetail(id);
    await whatsappOsAdminService.assertFieldActivityBelongsToFarmer(
      activityId,
      String(detail.lead.farmerId)
    );
    await whatsappOsAdminService.deleteFieldActivity(activityId);
    return reply.send({ ok: true });
  });
}
