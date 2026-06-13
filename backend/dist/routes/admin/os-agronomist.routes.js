import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { agronomistWorkflowService } from '../../services/admin/agronomist-workflow.service.js';
import { recommendationRecordsService } from '../../services/core/recommendation-records.service.js';
import { recommendationCommunicationService } from '../../services/core/recommendation-communication.service.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { recommendationFollowUpService } from '../../services/core/recommendation-follow-up.service.js';
import { crmFarmerService } from '../../services/admin/crm-farmer.service.js';
import { farmerExperienceLearningService } from '../../services/core/farmer-experience-learning.service.js';
import { agronomistCaseReviewService } from '../../services/admin/agronomist-case-review.service.js';
import { agronomistTierService } from '../../services/admin/agronomist-tier.service.js';
import { verifiedAdvisoryLearningService } from '../../services/core/verified-advisory-learning.service.js';
import { agronomistIntelligenceService } from '../../services/intelligence/agronomist-intelligence.service.js';
import { opportunityIntelligenceDashboardService } from '../../services/intelligence/opportunity-intelligence-dashboard.service.js';
import { caseReviewBodySchema, imageReviewBodySchema, recordOutcomeBodySchema } from '../../domain/ai-training/validators.js';
import { cropImageReviewService } from '../../services/core/crop-image-review.service.js';
import { confidenceLifecycleService } from '../../services/core/confidence-lifecycle.service.js';
import { outcomeReviewService } from '../../services/core/outcome-review.service.js';
import { trainingExportService } from '../../services/core/training-export.service.js';
import { weatherCorrelationService } from '../../services/core/weather-correlation.service.js';
import { agronomistMobileService } from '../../services/agronomist/agronomist-mobile.service.js';
import { routePlannerService } from '../../services/agronomist/route-planner.service.js';
import { telecallerAdminService } from '../../services/admin/telecaller-admin.service.js';
import { farmerNotesService } from '../../services/admin/farmer-notes.service.js';
import { whatsappOsAdminService } from '../../services/admin/whatsapp-os-admin.service.js';
const draftSchema = z.object({
    findingId: z.string().uuid(),
    farmerId: z.string().uuid(),
    blockId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    aiSessionId: z.string().uuid().optional(),
    recommendationId: z.string().uuid().optional(),
    issueDetected: z.string().max(500).optional(),
    recommendationText: z.string().min(1).max(8000),
    products: z.array(z.unknown()).optional(),
    dosage: z.string().max(2000).optional(),
    applicationType: z.string().max(120).optional(),
    weatherWarning: z.string().max(500).optional(),
    language: z.enum(['en', 'ml', 'ta', 'kn', 'hi']).optional(),
});
export async function osAgronomistRoutes(app) {
    const api = '/morbeez-staff/api/v1/os/agronomist';
    app.get(`${api}/workspace-intelligence`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const intelligence = await agronomistIntelligenceService.getWorkspaceIntelligence(admin.email);
        return reply.send({ ok: true, intelligence });
    });
    app.get(`${api}/farmers/:farmerId/intelligence`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const profile = await opportunityIntelligenceDashboardService.getFarmerProfile(farmerId);
        return reply.send({ ok: true, profile });
    });
    app.get(`${api}/cases`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = request.query;
        const result = await agronomistCaseReviewService.listQueue({
            status: q.status ?? 'open',
            sort: q.sort === 'newest' ? 'newest' : 'priority',
            page: q.page ? Number(q.page) : 1,
            limit: q.limit ? Number(q.limit) : 24,
        });
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/cases/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { id } = request.params;
        const detail = await agronomistCaseReviewService.getCaseDetail(id);
        return reply.send({ ok: true, ...detail });
    });
    app.post(`${api}/cases/:id/review`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const parsed = caseReviewBodySchema.safeParse(request.body);
        if (!parsed.success) {
            const message = parsed.error.issues
                .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
                .join('; ');
            return reply.status(400).send({ ok: false, error: 'VALIDATION_ERROR', message });
        }
        const body = parsed.data;
        const result = await agronomistCaseReviewService.submitReview(id, body, {
            email: admin.email,
            adminUserId: admin.id,
            role: admin.role,
        });
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/diagnosis-labels`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
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
        await assertModuleAccess(request, 'agronomist', 'write');
        const body = z
            .object({
            label: z.string().min(1).max(500),
            cropType: z.string().max(80).nullable().optional(),
        })
            .parse(request.body);
        const created = await agronomistCaseReviewService.createDiagnosisLabel(body);
        return reply.status(201).send({ ok: true, ...created });
    });
    app.get(`${api}/queue`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = request.query;
        const result = await agronomistWorkflowService.listReviewQueue(q.limit ? Number(q.limit) : 40);
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/findings/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { id } = request.params;
        const detail = await agronomistWorkflowService.getFindingDetail(id);
        return reply.send({ ok: true, ...detail });
    });
    app.post(`${api}/findings/:id/ai-suggest`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const suggestion = await agronomistWorkflowService.generateAiSuggestion(id);
        return reply.send({ ok: true, ...suggestion });
    });
    app.post(`${api}/drafts`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = draftSchema.parse(request.body);
        const row = await agronomistWorkflowService.saveDraft({
            ...body,
            createdBy: admin.email,
        });
        return reply.send({ ok: true, recommendation: row });
    });
    app.patch(`${api}/drafts/:id`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = draftSchema
            .partial()
            .omit({ findingId: true, farmerId: true })
            .extend({ status: z.enum(['draft', 'pending_approval', 'cancelled']).optional() })
            .parse(request.body);
        const updates = {
            updated_at: new Date().toISOString(),
            reviewed_by: admin.email,
        };
        if (body.blockId !== undefined)
            updates.block_id = body.blockId ?? null;
        if (body.leadId !== undefined)
            updates.lead_id = body.leadId ?? null;
        if (body.aiSessionId !== undefined)
            updates.ai_session_id = body.aiSessionId ?? null;
        if (body.recommendationId !== undefined)
            updates.crm_recommendation_id = body.recommendationId ?? null;
        if (body.issueDetected !== undefined)
            updates.issue_detected = body.issueDetected ?? null;
        if (body.recommendationText !== undefined)
            updates.recommendation_text = body.recommendationText;
        if (body.products !== undefined)
            updates.products = body.products;
        if (body.dosage !== undefined)
            updates.dosage = body.dosage ?? null;
        if (body.applicationType !== undefined)
            updates.application_type = body.applicationType ?? null;
        if (body.weatherWarning !== undefined)
            updates.weather_warning = body.weatherWarning ?? null;
        if (body.language !== undefined)
            updates.language = body.language;
        if (body.status !== undefined)
            updates.status = body.status;
        const { data, error } = await supabase
            .from('recommendation_records')
            .update(updates)
            .eq('id', id)
            .eq('source', 'field_finding')
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not update draft');
        return reply.send({ ok: true, recommendation: data });
    });
    app.delete(`${api}/drafts/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const { error } = await supabase
            .from('recommendation_records')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('source', 'field_finding');
        throwIfSupabaseError(error, 'Could not archive draft');
        return reply.send({ ok: true });
    });
    app.post(`${api}/recommendations/:id/submit`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        let row = await agronomistWorkflowService.submitForApproval(id, admin.email);
        const canSelf = await agronomistTierService.canSelfApproveRecommendations(admin.id, admin.email, admin.role);
        if (canSelf) {
            await agronomistTierService.assertOwnRecommendation(id, admin.email);
            row = await recommendationRecordsService.approve(id, admin.email);
            await verifiedAdvisoryLearningService
                .promoteFromRecommendationRecord(id, admin.email)
                .catch(() => { });
            const whatsapp = await recommendationCommunicationService
                .sendApprovedRecommendation(id)
                .catch(() => ({ sent: false }));
            return reply.send({ ok: true, recommendation: row, selfApproved: true, whatsapp });
        }
        return reply.send({ ok: true, recommendation: row, selfApproved: false });
    });
    app.get(`${api}/submissions`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const q = request.query;
        const rows = await agronomistWorkflowService.listAgronomistSubmissions(q.status, q.limit ? Number(q.limit) : 80, admin.email);
        return reply.send({ ok: true, recommendations: rows });
    });
    app.patch(`${api}/escalations/:id/assign`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = z
            .object({
            assignedTo: z.string().min(2).max(120),
            status: z.enum(['assigned', 'in_review']).optional(),
            slaHours: z.number().int().min(1).max(240).optional(),
        })
            .parse(request.body);
        const dueAt = body.slaHours
            ? new Date(Date.now() + body.slaHours * 60 * 60 * 1000).toISOString()
            : null;
        const { data, error } = await supabase
            .from('agronomist_escalations')
            .update({
            assigned_to: body.assignedTo,
            status: body.status ?? 'assigned',
            resolution_eta: dueAt,
            updated_at: new Date().toISOString(),
            metadata: { assignedBy: admin.email, slaHours: body.slaHours ?? null },
        })
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not assign escalation');
        return reply.send({ ok: true, escalation: data });
    });
    app.patch(`${api}/escalations/:id/status`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = z
            .object({
            status: z.enum(['pending', 'assigned', 'in_review', 'resolved', 'dismissed']),
            notes: z.string().max(2000).optional(),
        })
            .parse(request.body);
        const patch = {
            status: body.status,
            updated_at: new Date().toISOString(),
            resolution_notes: body.notes ?? null,
            assigned_to: admin.email,
        };
        if (body.status === 'resolved' || body.status === 'dismissed') {
            patch.resolved_at = new Date().toISOString();
        }
        const { data, error } = await supabase
            .from('agronomist_escalations')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not update escalation status');
        return reply.send({ ok: true, escalation: data });
    });
    app.get(`${api}/recommendations/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { id } = request.params;
        const row = await recommendationRecordsService.getById(id);
        if (!row)
            return reply.code(404).send({ ok: false, message: 'Not found' });
        return reply.send({ ok: true, recommendation: row });
    });
    app.post(`${api}/recommendations/:id/communicate`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const body = z.object({ force: z.boolean().optional() }).parse(request.body ?? {});
        const result = await recommendationCommunicationService.sendApprovedRecommendation(id, {
            force: body.force,
        });
        return reply.send({ ok: true, ...result });
    });
    app.patch(`${api}/recommendations/:id/outcome`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = z
            .object({
            outcome: z.enum(['better', 'partial', 'no_improvement', 'unknown']),
            outcomeNotes: z.string().max(2000).optional(),
        })
            .parse(request.body);
        const { data, error } = await supabase
            .from('recommendation_records')
            .update({
            status: 'outcome_recorded',
            outcome: body.outcome,
            outcome_notes: body.outcomeNotes ?? null,
            outcome_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not record outcome');
        return reply.send({ ok: true, recommendation: data });
    });
    /** Full treatment timeline for agronomist review (recommendations + applications + visits). */
    app.get(`${api}/farmers/:farmerId/blocks/:blockId/timeline`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId, blockId } = request.params;
        const [timeline, followUpRecs] = await Promise.all([
            crmFarmerService.blockTimeline(farmerId, blockId),
            recommendationFollowUpService.buildBlockTimelineEvents(blockId, farmerId),
        ]);
        const { data: applications } = await supabase
            .from('recommendation_applications')
            .select('*')
            .eq('farmer_id', farmerId)
            .eq('block_id', blockId)
            .order('applied_at', { ascending: false });
        const { data: recs } = await supabase
            .from('recommendation_records')
            .select('*')
            .eq('farmer_id', farmerId)
            .eq('block_id', blockId)
            .order('created_at', { ascending: false })
            .limit(20);
        return reply.send({
            ok: true,
            timeline,
            recommendationRecords: recs ?? [],
            applications: applications ?? [],
            events: followUpRecs,
        });
    });
    app.get(`${api}/farmer-feedback`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const items = await farmerExperienceLearningService.listPendingReview(50);
        return reply.send({ ok: true, items });
    });
    app.get(`${api}/farmer-feedback/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { id } = request.params;
        const detail = await farmerExperienceLearningService.getDetail(id);
        return reply.send({ ok: true, ...detail });
    });
    app.post(`${api}/farmer-feedback/:id/review`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = z
            .object({
            decision: z.enum(['approved', 'rejected', 'partial']),
            agronomistFinalDiagnosis: z.string().max(500).optional(),
            agronomistNotes: z.string().max(2000).optional(),
            confidenceAdjustment: z.number().min(0).max(1).optional(),
            updatedRecommendation: z.string().max(4000).optional(),
        })
            .parse(request.body);
        const feedback = await farmerExperienceLearningService.review(id, body, admin.email);
        return reply.send({ ok: true, feedback });
    });
    app.get(`${api}/confidence-stats`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z.object({ days: z.coerce.number().int().min(7).max(90).optional() }).parse(request.query ?? {});
        const stats = await confidenceLifecycleService.getRoutingStats(q.days ?? 30);
        return reply.send({ ok: true, stats });
    });
    app.get(`${api}/crop-images`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z
            .object({
            status: z.enum(['pending', 'reviewed', 'skipped', 'excluded', 'all']).optional(),
            crop: z.string().optional(),
            page: z.coerce.number().int().min(1).optional(),
            limit: z.coerce.number().int().min(1).max(50).optional(),
            sync: z
                .enum(['true', 'false'])
                .optional()
                .transform((v) => v !== 'false'),
        })
            .parse(request.query ?? {});
        const result = await cropImageReviewService.listQueue({
            status: q.status ?? 'pending',
            crop: q.crop,
            page: q.page,
            limit: q.limit,
            sync: q.sync,
        });
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/crop-images/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { id } = request.params;
        const detail = await cropImageReviewService.getDetail(id);
        return reply.send({ ok: true, ...detail });
    });
    app.post(`${api}/crop-images/:id/review`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = imageReviewBodySchema.parse(request.body);
        const image = await cropImageReviewService.submitReview(id, body, admin.email);
        return reply.send({ ok: true, image });
    });
    app.get(`${api}/outcome-review`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z
            .object({
            filter: z.enum(['pending', 'overdue', 'needs_review', 'all']).optional(),
            page: z.coerce.number().int().min(1).optional(),
            limit: z.coerce.number().int().min(1).max(50).optional(),
        })
            .parse(request.query ?? {});
        const result = await outcomeReviewService.listQueue({
            filter: q.filter ?? 'pending',
            page: q.page,
            limit: q.limit,
        });
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/outcome-review/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { id } = request.params;
        const detail = await outcomeReviewService.getDetail(id);
        return reply.send({ ok: true, ...detail });
    });
    app.post(`${api}/outcome-review/:id/record`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = recordOutcomeBodySchema.parse(request.body);
        const recommendation = await outcomeReviewService.recordOutcome(id, body, admin.email);
        return reply.send({ ok: true, recommendation });
    });
    app.get(`${api}/follow-up/kpis`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z.object({ days: z.coerce.number().int().min(7).max(365).optional() }).parse(request.query ?? {});
        const kpis = await recommendationFollowUpService.getKpis(q.days ?? 30);
        return reply.send({ ok: true, kpis });
    });
    app.get(`${api}/weather-correlation`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z.object({ days: z.coerce.number().int().min(14).max(365).optional() }).parse(request.query ?? {});
        const analytics = await weatherCorrelationService.getAnalytics(q.days ?? 90);
        return reply.send({ ok: true, analytics });
    });
    app.get(`${api}/training-export/dashboard`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z.object({ days: z.coerce.number().int().min(7).max(365).optional() }).parse(request.query ?? {});
        const stats = await trainingExportService.getDashboardStats(q.days ?? 30);
        return reply.send({ ok: true, stats });
    });
    app.get(`${api}/training-export/qa-flags`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }).parse(request.query ?? {});
        const result = await trainingExportService.listQaFlags(q.limit ?? 40);
        return reply.send({ ok: true, ...result });
    });
    app.patch(`${api}/training-export/qa-flag`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = z
            .object({
            entityType: z.enum(['training_event', 'crop_image']),
            entityId: z.string().uuid(),
            flag: z.enum(['needs_review', 'approved', 'excluded']),
            notes: z.string().max(500).optional(),
        })
            .parse(request.body);
        const result = await trainingExportService.setQaFlag({
            ...body,
            reviewedBy: admin.email,
        });
        return reply.send(result);
    });
    app.get(`${api}/training-export`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z
            .object({
            dataset: z.enum(['events', 'images', 'samples', 'weather', 'all']).optional(),
            format: z.enum(['json', 'csv']).optional(),
            since: z.string().datetime().optional(),
            limit: z.coerce.number().int().min(1).max(10000).optional(),
        })
            .parse(request.query ?? {});
        const exported = await trainingExportService.exportDataset({
            dataset: q.dataset ?? 'all',
            format: q.format ?? 'json',
            since: q.since,
            limit: q.limit,
        });
        reply.header('Content-Type', exported.contentType);
        reply.header('Content-Disposition', `attachment; filename="${exported.filename}"`);
        return reply.send(exported.body);
    });
    app.get(`${api}/mobile/dashboard`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const dashboard = await agronomistMobileService.getMobileDashboard(admin.email);
        return reply.send({ ok: true, dashboard });
    });
    app.get(`${api}/operations/tasks`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const q = z.object({ status: z.enum(['pending', 'done', 'all']).optional() }).parse(request.query ?? {});
        const tasks = await telecallerAdminService.listTasksForAgronomist(admin.email, q.status === 'all' ? undefined : { status: q.status ?? 'pending' });
        return reply.send({ ok: true, tasks });
    });
    app.get(`${api}/operations/visits`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const visits = await telecallerAdminService.listScheduledVisitsForAgronomist(admin.email);
        return reply.send({ ok: true, visits });
    });
    app.get(`${api}/operations/tasks/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { id } = request.params;
        const detail = await telecallerAdminService.getTaskDetail(id);
        return reply.send({ ok: true, ...detail });
    });
    app.post(`${api}/operations/tasks/:id/comments`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = z.object({ body: z.string().min(1).max(4000) }).parse(request.body);
        const comment = await telecallerAdminService.addTaskComment(id, {
            body: body.body,
            authorEmail: admin.email,
            authorRole: 'agronomist',
            authorName: admin.fullName ?? admin.email,
        });
        return reply.status(201).send({ ok: true, comment });
    });
    app.patch(`${api}/operations/tasks/:id/complete`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        await telecallerAdminService.completeTask(id);
        return reply.send({ ok: true });
    });
    app.post(`${api}/operations/leads/:leadId/schedule-visit`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { leadId } = request.params;
        const body = z
            .object({
            title: z.string().optional(),
            dueAt: z.string(),
            notes: z.string().optional(),
            blockId: z.string().uuid().optional(),
        })
            .parse(request.body);
        const detail = await telecallerAdminService.getLeadDetail(leadId);
        const result = await crmFarmerService.scheduleVisit(String(detail.lead.farmerId), leadId, {
            ...body,
            assignedAgronomist: admin.email,
            assignedTo: admin.email,
            createdBy: admin.email,
        });
        return reply.status(201).send({ ok: true, ...result });
    });
    app.get(`${api}/mobile/farmers`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const q = z
            .object({
            q: z.string().optional(),
            filter: z.enum(['assigned', 'recently_visited', 'follow_up_due', 'escalation_open', 'nearby']).optional(),
            lat: z.coerce.number().optional(),
            lng: z.coerce.number().optional(),
            limit: z.coerce.number().int().min(1).max(80).optional(),
        })
            .parse(request.query ?? {});
        const farmers = await agronomistMobileService.listMobileFarmers(admin.email, q);
        return reply.send({ ok: true, farmers });
    });
    app.get(`${api}/farmers/:farmerId/workspace-summary`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const summary = await agronomistMobileService.getWorkspaceSummary(farmerId);
        return reply.send({ ok: true, summary });
    });
    app.get(`${api}/farmers/:farmerId/workspace-dashboard`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const dashboard = await agronomistMobileService.getWorkspaceDashboard(farmerId);
        return reply.send({ ok: true, dashboard });
    });
    app.get(`${api}/farmers/:farmerId/visits`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const q = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }).parse(request.query ?? {});
        const visits = await agronomistMobileService.listFarmerVisits(farmerId, q.limit ?? 30);
        return reply.send({ ok: true, visits });
    });
    app.get(`${api}/farmers/:farmerId/orders`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const result = await agronomistMobileService.listFarmerOrders(farmerId);
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/farmers/:farmerId/whatsapp-history`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const messages = await agronomistMobileService.listWhatsAppHistory(farmerId);
        return reply.send({ ok: true, messages });
    });
    app.post(`${api}/farmers/:farmerId/calls`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { farmerId } = request.params;
        const body = z
            .object({
            outcome: z.string().optional(),
            notes: z.string().max(2000).optional(),
            durationSeconds: z.number().int().min(0).optional(),
        })
            .parse(request.body);
        const result = await agronomistMobileService.logFarmerCall(farmerId, admin.email, body);
        return reply.status(201).send({ ok: true, result });
    });
    app.post(`${api}/farmers/:farmerId/reminders`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { farmerId } = request.params;
        const body = z
            .object({
            reason: z.string().min(1).max(500),
            dueAt: z.string().datetime().optional(),
            assignTo: z.enum(['agronomist', 'telecaller']).optional(),
        })
            .parse(request.body);
        const task = await agronomistMobileService.createFarmerReminder(farmerId, admin.email, body);
        return reply.status(201).send({ ok: true, task });
    });
    app.get(`${api}/farmers/:farmerId/documents`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const documents = await agronomistMobileService.listFarmerDocuments(farmerId);
        return reply.send({ ok: true, documents });
    });
    app.get(`${api}/farmers/:farmerId/recommendations`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const q = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }).parse(request.query ?? {});
        const recommendations = await agronomistMobileService.listFarmerRecommendations(farmerId, q.limit ?? 20);
        return reply.send({ ok: true, recommendations });
    });
    app.get(`${api}/farmers/:farmerId/blocks/:blockId/detail`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId, blockId } = request.params;
        const detail = await agronomistMobileService.getBlockDetail(farmerId, blockId);
        return reply.send({ ok: true, ...detail });
    });
    app.post(`${api}/farmers/:farmerId/recommendations`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { farmerId } = request.params;
        const body = z
            .object({
            blockId: z.string().uuid().optional(),
            leadId: z.string().uuid().optional(),
            fieldFindingId: z.string().uuid().optional(),
            issueDetected: z.string().max(500).optional(),
            recommendationText: z.string().min(1).max(8000),
            dosage: z.string().max(2000).optional(),
            weatherWarning: z.string().max(500).optional(),
            language: z.enum(['en', 'ml', 'ta', 'kn', 'hi']).optional(),
        })
            .parse(request.body);
        const recommendation = await agronomistMobileService.createFarmerRecommendation(farmerId, admin.email, body);
        return reply.status(201).send({ ok: true, recommendation });
    });
    app.get(`${api}/mobile/tasks`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const q = z.object({ filter: z.string().optional() }).parse(request.query ?? {});
        const tasks = await agronomistMobileService.listUnifiedTasks(admin.email, q.filter);
        return reply.send({ ok: true, tasks });
    });
    app.get(`${api}/callbacks`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const callbacks = await agronomistMobileService.listCallbacks(admin.email);
        return reply.send({ ok: true, callbacks });
    });
    app.patch(`${api}/callbacks/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = z.object({ status: z.enum(['completed', 'cancelled', 'pending', 'open']) }).parse(request.body);
        const row = await agronomistMobileService.updateCallback(id, body.status);
        return reply.send({ ok: true, callback: row });
    });
    app.post(`${api}/callbacks`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = z
            .object({
            farmerId: z.string().uuid(),
            reason: z.string().min(1).max(500),
            dueInDays: z.number().int().min(1).max(30).optional(),
        })
            .parse(request.body);
        const row = await agronomistMobileService.createCallback(admin.email, body);
        return reply.status(201).send({ ok: true, callback: row });
    });
    app.get(`${api}/mobile/escalations`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z
            .object({ status: z.string().optional(), farmerId: z.string().uuid().optional() })
            .parse(request.query ?? {});
        const escalations = await agronomistMobileService.listEscalations(q);
        return reply.send({ ok: true, escalations });
    });
    app.get(`${api}/mobile/profile`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const profile = await agronomistMobileService.getProfileStats(admin.email);
        return reply.send({ ok: true, profile });
    });
    app.get(`${api}/mobile/notifications`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const notifications = await agronomistMobileService.listNotifications(admin.email);
        return reply.send({ ok: true, notifications });
    });
    app.get(`${api}/farmers/:farmerId/team-timeline`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const { farmerTeamTimelineService } = await import('../../services/crm/farmer-team-timeline.service.js');
        const timeline = await farmerTeamTimelineService.listForFarmer(farmerId);
        return reply.send({ ok: true, timeline });
    });
    app.post(`${api}/farmers/:farmerId/team-timeline`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { farmerId } = request.params;
        const body = z.object({ body: z.string().min(1).max(8000) }).parse(request.body);
        const { farmerTeamTimelineService } = await import('../../services/crm/farmer-team-timeline.service.js');
        const entry = await farmerTeamTimelineService.addComment({
            farmerId,
            body: body.body,
            authorType: 'expert',
            authorEmail: admin.email,
            authorName: admin.email,
        });
        return reply.send({ ok: true, entry });
    });
    app.get(`${api}/routes`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const q = z.object({ date: z.string().optional() }).parse(request.query ?? {});
        const routes = await routePlannerService.listRoutes(admin.email, q.date);
        return reply.send({ ok: true, routes });
    });
    app.post(`${api}/routes`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = z.object({ routeName: z.string().min(1).max(120) }).parse(request.body);
        const route = await routePlannerService.createRoute(admin.email, body.routeName);
        return reply.status(201).send({ ok: true, route });
    });
    app.post(`${api}/routes/:id/stops`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = z
            .object({ farmerId: z.string().uuid(), blockId: z.string().uuid().optional() })
            .parse(request.body);
        const stop = await routePlannerService.addStop(id, body.farmerId, body.blockId);
        return reply.status(201).send({ ok: true, stop });
    });
    app.post(`${api}/routes/:id/optimize`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const body = z.object({ lat: z.number().optional(), lng: z.number().optional() }).parse(request.body ?? {});
        const route = await routePlannerService.optimizeRoute(id, body.lat, body.lng);
        return reply.send({ ok: true, route });
    });
    app.get(`${api}/routes/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { id } = request.params;
        const route = await routePlannerService.getRouteSummary(id);
        return reply.send({ ok: true, route });
    });
    app.get(`${api}/farmers/:farmerId/notes`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const notes = await farmerNotesService.list(farmerId);
        return reply.send({ ok: true, notes });
    });
    app.post(`${api}/farmers/:farmerId/notes`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { farmerId } = request.params;
        const body = z.object({ noteText: z.string().min(1).max(4000) }).parse(request.body);
        const note = await farmerNotesService.create(farmerId, admin.email, body.noteText);
        return reply.status(201).send({ ok: true, note });
    });
    app.get(`${api}/farmers/:farmerId/call-log-summary`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const summary = await agronomistMobileService.getCallLogSummary(farmerId);
        return reply.send({ ok: true, summary });
    });
    app.get(`${api}/farmers/:farmerId/interactions`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const q = request.query;
        const result = await agronomistMobileService.listFarmerInteractions(farmerId, q.leadId ?? null, q.page ? Number(q.page) : 1, q.limit ? Number(q.limit) : 40);
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/farmers/:farmerId/interactions/:interactionId`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId, interactionId } = request.params;
        const q = request.query;
        const interaction = await agronomistMobileService.getFarmerInteractionDetail(farmerId, interactionId, q.leadId ?? null);
        return reply.send({ ok: true, interaction });
    });
    app.get(`${api}/farmers/:farmerId/follow-ups`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const [tasksRes, followUpsRes, callbacksRes] = await Promise.all([
            supabase
                .from('crm_tasks')
                .select('id, title, task_type, task_category, due_at, status, assigned_to')
                .eq('farmer_id', farmerId)
                .eq('status', 'pending')
                .order('due_at', { ascending: true })
                .limit(40),
            supabase
                .from('recommendation_follow_ups')
                .select('id, recommendation_record_id, follow_up_type, due_at, status, notes')
                .eq('farmer_id', farmerId)
                .in('status', ['scheduled', 'sent', 'pending'])
                .order('due_at', { ascending: true })
                .limit(40),
            supabase
                .from('callback_requests')
                .select('id, reason, status, scheduled_at')
                .eq('farmer_id', farmerId)
                .in('status', ['pending', 'open', 'requested'])
                .limit(20),
        ]);
        throwIfSupabaseError(tasksRes.error, 'Could not load follow-ups');
        return reply.send({
            ok: true,
            tasks: tasksRes.data ?? [],
            recommendationFollowUps: followUpsRes.data ?? [],
            callbacks: callbacksRes.data ?? [],
        });
    });
    app.get(`${api}/farmers/:farmerId/soil-reports`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const reports = await crmFarmerService.listSoilReports(farmerId);
        return reply.send({ ok: true, reports });
    });
    app.post(`${api}/farmers/:farmerId/soil-reports`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { farmerId } = request.params;
        const body = z
            .object({
            blockId: z.string().uuid().optional(),
            metrics: z.record(z.unknown()).optional(),
            pdfUrl: z.string().optional(),
        })
            .parse(request.body);
        const report = await crmFarmerService.createSoilReport(farmerId, {
            blockId: body.blockId,
            metrics: body.metrics,
            pdfUrl: body.pdfUrl,
            uploadedBy: admin.email,
        });
        return reply.status(201).send({ ok: true, report });
    });
    app.post(`${api}/farmers/:farmerId/field-activities`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { farmerId } = request.params;
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
            status: z.enum(['completed', 'pending', 'cancelled']).optional(),
        })
            .parse(request.body);
        await whatsappOsAdminService.assertFarmBlockBelongsToFarmer(body.blockId, farmerId);
        const activity = await whatsappOsAdminService.createFieldActivity({
            ...body,
            assignedEmployee: admin.email,
        });
        return reply.status(201).send({ ok: true, activity });
    });
}
//# sourceMappingURL=os-agronomist.routes.js.map