import { z } from 'zod';
import rateLimit from '@fastify/rate-limit';
import { env } from '../../config/env.js';
import { requirePartner } from '../../middleware/require-partner.js';
import { partnerAuthService } from '../../services/partner/partner-auth.service.js';
import { partnerMobileService } from '../../services/partner/partner-mobile.service.js';
import { partnerEnrollmentService } from '../../services/partner/partner-enrollment.service.js';
import { partnerLeadAllocationService } from '../../services/partner/partner-lead-allocation.service.js';
import { partnerTimelineService } from '../../services/partner/partner-timeline.service.js';
import { partnerService } from '../../services/partner/partner.service.js';
import { routePlannerService } from '../../services/agronomist/route-planner.service.js';
import { partnerFarmerWorkspaceService } from '../../services/partner/partner-farmer-workspace.service.js';
import { structuredFieldVisitSchema } from '../../domain/ai-training/validators.js';
import { fieldFindingsMastersService } from '../../services/admin/field-findings-masters.service.js';
export async function partnerApiRoutes(app) {
    const api = '/morbeez-partner/api/v1';
    await app.register(async (partnerApp) => {
        await partnerApp.register(rateLimit, {
            max: env.AUTH_RATE_LIMIT_MAX,
            timeWindow: env.RATE_LIMIT_WINDOW_MS,
        });
        partnerApp.post(`${api}/auth/otp/send`, async (request, reply) => {
            const body = z.object({ phone: z.string().min(10) }).parse(request.body);
            const result = await partnerAuthService.sendOtp(body.phone, request.ip);
            return reply.send({ ok: true, ...result });
        });
        partnerApp.post(`${api}/auth/otp/verify`, async (request, reply) => {
            const body = z.object({ phone: z.string().min(10), code: z.string().min(4) }).parse(request.body);
            const result = await partnerAuthService.verifyOtp(body.phone, body.code);
            return reply.send({ ok: true, ...result });
        });
        partnerApp.post(`${api}/auth/login`, async (request, reply) => {
            const body = z
                .object({ phone: z.string().min(10), password: z.string().min(8) })
                .parse(request.body);
            const result = await partnerAuthService.loginWithPassword(body.phone, body.password);
            return reply.send({ ok: true, ...result });
        });
        partnerApp.get(`${api}/me`, async (request, reply) => {
            const partner = await requirePartner(request);
            return reply.send({ ok: true, partner });
        });
        partnerApp.get(`${api}/dashboard`, async (request, reply) => {
            const partner = await requirePartner(request);
            const stats = await partnerMobileService.getDashboard(partner.id);
            return reply.send({ ok: true, stats });
        });
        partnerApp.get(`${api}/farmers`, async (request, reply) => {
            const partner = await requirePartner(request);
            const farmers = await partnerMobileService.listPartnerFarmers(partner.id);
            return reply.send({ ok: true, farmers });
        });
        partnerApp.get(`${api}/farmers/:farmerId`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            const workspace = await partnerMobileService.getFarmerWorkspace(partner.id, farmerId);
            return reply.send({ ok: true, workspace });
        });
        partnerApp.get(`${api}/farmers/:farmerId/tasks`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const tasks = await partnerFarmerWorkspaceService.listFarmerTasks(partner.id, farmerId);
            return reply.send({ ok: true, tasks });
        });
        partnerApp.get(`${api}/farmers/:farmerId/orders`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const orders = await partnerFarmerWorkspaceService.listFarmerOrders(farmerId);
            return reply.send({ ok: true, orders });
        });
        partnerApp.get(`${api}/farmers/:farmerId/escalations`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const escalations = await partnerFarmerWorkspaceService.listFarmerEscalations(farmerId);
            return reply.send({ ok: true, escalations });
        });
        partnerApp.post(`${api}/farmers/:farmerId/escalations`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const body = z
                .object({
                category: z.enum([
                    'unknown_disease',
                    'recommendation_failure',
                    'yield_risk',
                    'repeated_issue',
                ]),
                notes: z.string().min(1).max(2000),
            })
                .parse(request.body);
            const entry = await partnerFarmerWorkspaceService.createEscalation(partner.id, farmerId, body, partner.fullName);
            return reply.status(201).send({ ok: true, entry });
        });
        partnerApp.get(`${api}/farmers/:farmerId/interactions`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const interactions = await partnerFarmerWorkspaceService.getInteractions(farmerId);
            return reply.send({ ok: true, interactions });
        });
        partnerApp.get(`${api}/farmers/:farmerId/recommendations`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const recommendations = await partnerFarmerWorkspaceService.listFarmerRecommendations(farmerId);
            return reply.send({ ok: true, recommendations });
        });
        partnerApp.get(`${api}/farmers/:farmerId/visit-sessions`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const sessions = await partnerFarmerWorkspaceService.listVisitSessions(partner.id, farmerId);
            return reply.send({ ok: true, sessions });
        });
        partnerApp.post(`${api}/farmers/:farmerId/schedule-callback`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const body = z.object({ notes: z.string().min(1).max(500) }).parse(request.body);
            const task = await partnerFarmerWorkspaceService.scheduleCallback(partner.id, farmerId, body.notes, partner.fullName);
            return reply.send({ ok: true, task });
        });
        partnerApp.post(`${api}/farmers/:farmerId/team-timeline`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const body = z.object({ body: z.string().min(1).max(8000) }).parse(request.body);
            const entry = await partnerFarmerWorkspaceService.addTeamComment(partner.id, farmerId, body.body, partner.fullName);
            return reply.send({ ok: true, entry });
        });
        partnerApp.get(`${api}/farmers/:farmerId/blocks/:blockId/detail`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId, blockId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const detail = await partnerFarmerWorkspaceService.getBlockDetail(farmerId, blockId);
            return reply.send({ ok: true, ...detail });
        });
        partnerApp.get(`${api}/farmers/:farmerId/blocks/:blockId/timeline`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId, blockId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const timeline = await partnerFarmerWorkspaceService.getBlockTimeline(farmerId, blockId);
            return reply.send({ ok: true, timeline });
        });
        partnerApp.post(`${api}/blocks/:blockId/location`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { blockId } = request.params;
            const body = z
                .object({
                farmerId: z.string().uuid(),
                latitude: z.number(),
                longitude: z.number(),
            })
                .parse(request.body);
            await partnerMobileService.assertFarmerAccess(partner.id, body.farmerId);
            const block = await partnerMobileService.saveBlockLocation({
                blockId,
                farmerId: body.farmerId,
                latitude: body.latitude,
                longitude: body.longitude,
            });
            return reply.send({ ok: true, block });
        });
        partnerApp.get(`${api}/tasks`, async (request, reply) => {
            const partner = await requirePartner(request);
            const tasks = await partnerMobileService.listTasks(partner.id);
            return reply.send({ ok: true, tasks });
        });
        partnerApp.post(`${api}/tasks/:taskId/accept`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { taskId } = request.params;
            const task = await partnerMobileService.acceptTask(taskId, partner.id);
            return reply.send({ ok: true, task });
        });
        partnerApp.post(`${api}/tasks/:taskId/complete`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { taskId } = request.params;
            const task = await partnerMobileService.completeTask(taskId, partner.id);
            return reply.send({ ok: true, task });
        });
        partnerApp.post(`${api}/tasks/:taskId/reject`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { taskId } = request.params;
            const body = z.object({ reason: z.string().min(1).max(500) }).parse(request.body);
            const task = await partnerMobileService.rejectTask(taskId, partner.id, body.reason);
            return reply.send({ ok: true, task });
        });
        partnerApp.patch(`${api}/tasks/:taskId/reschedule`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { taskId } = request.params;
            const body = z.object({ dueAt: z.string().datetime() }).parse(request.body);
            const task = await partnerMobileService.rescheduleTask(taskId, partner.id, body.dueAt);
            return reply.send({ ok: true, task });
        });
        partnerApp.get(`${api}/visits`, async (request, reply) => {
            const partner = await requirePartner(request);
            const visits = await partnerMobileService.listVisits(partner.id);
            return reply.send({ ok: true, visits });
        });
        partnerApp.get(`${api}/notifications`, async (request, reply) => {
            const partner = await requirePartner(request);
            const notifications = await partnerMobileService.listNotifications(partner.id);
            return reply.send({ ok: true, notifications });
        });
        partnerApp.get(`${api}/farmers/:farmerId/team-timeline`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const { farmerTeamTimelineService } = await import('../../services/crm/farmer-team-timeline.service.js');
            const timeline = await farmerTeamTimelineService.listForFarmer(farmerId);
            return reply.send({ ok: true, timeline });
        });
        partnerApp.post(`${api}/farmers/:farmerId/sales-opportunities`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const body = z
                .object({
                product: z.string().min(1),
                expectedQuantity: z.string().optional(),
                urgency: z.string().optional(),
                interestLevel: z.string().optional(),
                notes: z.string().optional(),
            })
                .parse(request.body);
            const { salesOpportunityService } = await import('../../services/partner/sales-opportunity.service.js');
            const row = await salesOpportunityService.createForPartner(partner.id, farmerId, body);
            return reply.status(201).send({ ok: true, opportunity: row });
        });
        partnerApp.get(`${api}/farmers/:farmerId/sales-opportunities`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const { salesOpportunityService } = await import('../../services/partner/sales-opportunity.service.js');
            const opportunities = await salesOpportunityService.listForFarmer(farmerId);
            return reply.send({ ok: true, opportunities });
        });
        partnerApp.post(`${api}/farmers/:farmerId/support-request`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            const body = z
                .object({
                requestType: z.enum([
                    'expert_opinion',
                    'soil_interpretation',
                    'joint_visit',
                    'disease_confirmation',
                ]),
                notes: z.string().min(1).max(2000),
            })
                .parse(request.body);
            const result = await partnerMobileService.createSupportRequest(partner.id, farmerId, body, partner.fullName);
            return reply.send(result);
        });
        partnerApp.get(`${api}/earnings/summary`, async (request, reply) => {
            const partner = await requirePartner(request);
            const q = z
                .object({
                from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
                to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
                month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
            })
                .parse(request.query ?? {});
            const { partnerEarningsService } = await import('../../services/partner/partner-earnings.service.js');
            const summary = await partnerEarningsService.getSummary(partner.id, q);
            return reply.send({ ok: true, summary });
        });
        partnerApp.get(`${api}/earnings/ledger`, async (request, reply) => {
            const partner = await requirePartner(request);
            const q = z
                .object({
                month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
                from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
                to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            })
                .parse(request.query ?? {});
            const { partnerEarningsService } = await import('../../services/partner/partner-earnings.service.js');
            const ledger = await partnerEarningsService.listLedger(partner.id, q);
            return reply.send({ ok: true, ledger });
        });
        partnerApp.post(`${api}/visits/sessions/start`, async (request, reply) => {
            const partner = await requirePartner(request);
            const body = z
                .object({
                farmerId: z.string().uuid(),
                blockId: z.string().uuid().optional(),
                latitude: z.number().optional(),
                longitude: z.number().optional(),
            })
                .parse(request.body);
            const session = await partnerMobileService.startVisitSession({
                partnerId: partner.id,
                ...body,
            });
            return reply.send({ ok: true, session });
        });
        partnerApp.post(`${api}/visits/sessions/:sessionId/check-out`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { sessionId } = request.params;
            const body = z
                .object({
                latitude: z.number().optional(),
                longitude: z.number().optional(),
                fieldFindingId: z.string().uuid().optional(),
            })
                .parse(request.body ?? {});
            const session = await partnerMobileService.checkOutVisitSession(sessionId, partner.id, body);
            return reply.send({ ok: true, session });
        });
        partnerApp.post(`${api}/visits/submit`, async (request, reply) => {
            const partner = await requirePartner(request);
            const body = structuredFieldVisitSchema.parse(request.body);
            const result = await partnerMobileService.submitVisit(body, partner.id, partner.fullName);
            return reply.send({ ok: true, ...result });
        });
        partnerApp.get(`${api}/issue-master`, async (request, reply) => {
            await requirePartner(request);
            const q = request.query;
            const { issueCategorySchema } = await import('../../domain/ai-training/validators.js');
            const items = await fieldFindingsMastersService.listIssueMaster({
                cropType: q.cropType,
                category: q.category ? issueCategorySchema.parse(q.category) : undefined,
            });
            return reply.send({ ok: true, items });
        });
        partnerApp.post(`${api}/issue-master`, async (request, reply) => {
            await requirePartner(request);
            const { issueCategorySchema } = await import('../../domain/ai-training/validators.js');
            const body = z
                .object({
                category: issueCategorySchema,
                issueName: z.string().min(1).max(200),
                cropType: z.string().optional(),
            })
                .parse(request.body);
            const row = await fieldFindingsMastersService.createIssueMaster(body);
            return reply.status(201).send({
                ok: true,
                item: {
                    id: String(row.id),
                    category: String(row.category),
                    issueName: String(row.issue_name),
                    cropType: row.crop_type ? String(row.crop_type) : null,
                },
            });
        });
        partnerApp.get(`${api}/measurement-templates/:cropType`, async (request, reply) => {
            await requirePartner(request);
            const { cropType } = request.params;
            const { fieldVisitService } = await import('../../services/admin/field-visit.service.js');
            const templates = await fieldVisitService.listMeasurementTemplates(cropType);
            return reply.send({ ok: true, templates });
        });
        partnerApp.post(`${api}/visits/context`, async (request, reply) => {
            await requirePartner(request);
            const { visitAiContextRequestSchema } = await import('../../domain/ai-training/validators.js');
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const body = visitAiContextRequestSchema.parse(request.body);
            const context = await visitAiOrchestratorService.buildContext(body);
            return reply.send({ ok: true, context });
        });
        partnerApp.get(`${api}/visits/environment`, async (request, reply) => {
            await requirePartner(request);
            const { z: zod } = await import('zod');
            const { visitEnvironmentService } = await import('../../services/core/visit-environment.service.js');
            const q = zod
                .object({ farmerId: zod.string().uuid(), blockId: zod.string().uuid() })
                .parse(request.query ?? {});
            const environment = await visitEnvironmentService.getEnvironment(q.farmerId, q.blockId);
            return reply.send({ ok: true, ...environment });
        });
        partnerApp.post(`${api}/visits/photos/validate`, async (request, reply) => {
            await requirePartner(request);
            const { z: zod } = await import('zod');
            const { visitPhotoValidationService } = await import('../../services/core/visit-photo-validation.service.js');
            const body = zod
                .object({
                dataBase64: zod.string().min(10).max(7_000_000),
                mimeType: zod.string().optional(),
            })
                .parse(request.body);
            const result = visitPhotoValidationService.validateBase64(body.dataBase64, body.mimeType);
            return reply.send(result);
        });
        partnerApp.post(`${api}/visits/analyze`, async (request, reply) => {
            await requirePartner(request);
            const { visitAnalyzeRequestSchema } = await import('../../domain/ai-training/validators.js');
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const { sanitizeVisitAiForPartner } = await import('../../services/partner/partner-response-sanitizer.js');
            const body = visitAnalyzeRequestSchema.parse(request.body);
            const result = await visitAiOrchestratorService.analyze(body, 'partner');
            return reply.send(sanitizeVisitAiForPartner({ ok: true, ...result }));
        });
        partnerApp.post(`${api}/visits/triage-preview`, async (request, reply) => {
            await requirePartner(request);
            const { visitAnalyzeVisitRequestSchema } = await import('../../domain/ai-training/validators.js');
            const { diagnosisOrchestratorService } = await import('../../services/diagnosis/diagnosis-orchestrator.service.js');
            const body = visitAnalyzeVisitRequestSchema.parse(request.body);
            const triage = await diagnosisOrchestratorService.triagePreview(body);
            const capability = diagnosisOrchestratorService.getCapabilityStatus();
            return reply.send({ ok: true, triage, capability });
        });
        partnerApp.post(`${api}/visits/analyze-visit`, async (request, reply) => {
            await requirePartner(request);
            const { visitAnalyzeVisitRequestSchema } = await import('../../domain/ai-training/validators.js');
            const { diagnosisOrchestratorService } = await import('../../services/diagnosis/diagnosis-orchestrator.service.js');
            const { sanitizeVisitAiForPartner } = await import('../../services/partner/partner-response-sanitizer.js');
            const body = visitAnalyzeVisitRequestSchema.parse(request.body);
            const result = await diagnosisOrchestratorService.analyzeVisit(body, 'partner');
            return reply.send(sanitizeVisitAiForPartner({ ok: true, ...result }));
        });
        partnerApp.get(`${api}/visits/ai-case/:aiCaseId/questions`, async (request, reply) => {
            await requirePartner(request);
            const { aiCaseId } = request.params;
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const questions = await visitAiOrchestratorService.getQuestions(aiCaseId);
            return reply.send({ ok: true, questions });
        });
        partnerApp.post(`${api}/visits/ai-case/:aiCaseId/questions`, async (request, reply) => {
            await requirePartner(request);
            const { aiCaseId } = request.params;
            const { visitAiAnswersBodySchema } = await import('../../domain/ai-training/validators.js');
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const { sanitizeVisitAiForPartner } = await import('../../services/partner/partner-response-sanitizer.js');
            const body = visitAiAnswersBodySchema.parse(request.body);
            const result = await visitAiOrchestratorService.saveAnswers(aiCaseId, body);
            return reply.send(sanitizeVisitAiForPartner({ ok: true, ...result }));
        });
        partnerApp.put(`${api}/visits/ai-case/:aiCaseId/questions`, async (request, reply) => {
            await requirePartner(request);
            const { aiCaseId } = request.params;
            const { visitAiSyncQuestionsBodySchema } = await import('../../domain/ai-training/validators.js');
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const body = visitAiSyncQuestionsBodySchema.parse(request.body);
            const result = await visitAiOrchestratorService.syncQuestions(aiCaseId, body);
            return reply.send({ ok: true, ...result });
        });
        partnerApp.post(`${api}/visits/ai-case/:aiCaseId/questions/regenerate`, async (request, reply) => {
            await requirePartner(request);
            const { aiCaseId } = request.params;
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const questions = await visitAiOrchestratorService.regenerateQuestions(aiCaseId);
            return reply.send({ ok: true, questions });
        });
        partnerApp.post(`${api}/visits/ai-case/:aiCaseId/reanalyze`, async (request, reply) => {
            await requirePartner(request);
            const { aiCaseId } = request.params;
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const { sanitizeVisitAiForPartner } = await import('../../services/partner/partner-response-sanitizer.js');
            const result = await visitAiOrchestratorService.reanalyze(aiCaseId);
            return reply.send(sanitizeVisitAiForPartner({ ok: true, ...result }));
        });
        partnerApp.post(`${api}/visits/ai-case/:aiCaseId/skip-qa`, async (request, reply) => {
            await requirePartner(request);
            const { aiCaseId } = request.params;
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const result = await visitAiOrchestratorService.skipFollowUp(aiCaseId);
            return reply.send({ ok: true, ...result });
        });
        partnerApp.get(`${api}/visits/ai-case/:aiCaseId`, async (request, reply) => {
            await requirePartner(request);
            const { aiCaseId } = request.params;
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const { sanitizeVisitAiForPartner } = await import('../../services/partner/partner-response-sanitizer.js');
            const detail = await visitAiOrchestratorService.getCaseDetail(aiCaseId);
            return reply.send(sanitizeVisitAiForPartner({ ok: true, case: detail }));
        });
        partnerApp.post(`${api}/visits/ai-case/:aiCaseId/recommend`, async (request, reply) => {
            await requirePartner(request);
            const { aiCaseId } = request.params;
            const { visitAiRecommendBodySchema } = await import('../../domain/ai-training/validators.js');
            const { visitAiOrchestratorService } = await import('../../services/core/visit-ai-orchestrator.service.js');
            const body = visitAiRecommendBodySchema.parse(request.body ?? {});
            const result = await visitAiOrchestratorService.recommend(aiCaseId, body.finalDiagnosis);
            return reply.send({ ok: true, ...result });
        });
        partnerApp.get(`${api}/visits/:findingId`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { findingId } = request.params;
            const { fieldVisitService } = await import('../../services/admin/field-visit.service.js');
            const detail = await fieldVisitService.getVisitDetail(findingId);
            await partnerMobileService.assertFarmerAccess(partner.id, String(detail.finding.farmer_id));
            return reply.send({ ok: true, ...detail });
        });
        partnerApp.get(`${api}/lead-offers`, async (request, reply) => {
            const partner = await requirePartner(request);
            const offers = await partnerLeadAllocationService.listOffers(partner.id);
            return reply.send({ ok: true, offers });
        });
        partnerApp.post(`${api}/lead-offers/:id/respond`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { id } = request.params;
            const body = z.object({ action: z.enum(['accepted', 'declined']) }).parse(request.body);
            const row = await partnerLeadAllocationService.respond(id, partner.id, body.action);
            return reply.send({ ok: true, allocation: row });
        });
        partnerApp.get(`${api}/farmers/:farmerId/timeline`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const timeline = await partnerTimelineService.listForFarmer(farmerId);
            return reply.send({ ok: true, timeline });
        });
        partnerApp.post(`${api}/farmers/:farmerId/timeline`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { farmerId } = request.params;
            await partnerMobileService.assertFarmerAccess(partner.id, farmerId);
            const body = z
                .object({
                body: z.string().min(1).max(8000),
                entryType: z
                    .enum(['note', 'comment', 'escalation', 'support_request', 'review_request'])
                    .optional(),
            })
                .parse(request.body);
            const entry = await partnerTimelineService.addEntry({
                farmerId,
                body: body.body,
                authorType: 'partner',
                partnerId: partner.id,
                authorName: partner.fullName,
                entryType: body.entryType ?? 'note',
            });
            return reply.send({ ok: true, entry });
        });
        partnerApp.get(`${api}/referral`, async (request, reply) => {
            const partner = await requirePartner(request);
            return reply.send({
                ok: true,
                partnerCode: partner.partnerCode,
                referralUrl: partner.referralUrl,
                qrToken: partner.qrToken,
            });
        });
        partnerApp.get(`${api}/routes`, async (request, reply) => {
            const partner = await requirePartner(request);
            const q = z.object({ date: z.string().optional() }).parse(request.query ?? {});
            const routes = await routePlannerService.listRoutes({ agentType: 'partner', partnerId: partner.id }, q.date);
            return reply.send({ ok: true, routes });
        });
        partnerApp.post(`${api}/routes`, async (request, reply) => {
            const partner = await requirePartner(request);
            const body = z.object({ routeName: z.string().min(1).max(120) }).parse(request.body);
            const route = await routePlannerService.createRoute({ agentType: 'partner', partnerId: partner.id }, body.routeName);
            return reply.status(201).send({ ok: true, route });
        });
        partnerApp.get(`${api}/routes/:id`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { id } = request.params;
            const route = await routePlannerService.getRouteSummary(id, {
                agentType: 'partner',
                partnerId: partner.id,
            });
            return reply.send({ ok: true, route });
        });
        partnerApp.post(`${api}/routes/:id/stops`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { id } = request.params;
            const body = z
                .object({ farmerId: z.string().uuid(), blockId: z.string().uuid().optional() })
                .parse(request.body);
            const stop = await routePlannerService.addStop({ agentType: 'partner', partnerId: partner.id }, id, body.farmerId, body.blockId);
            return reply.status(201).send({ ok: true, stop });
        });
        partnerApp.post(`${api}/routes/:id/optimize`, async (request, reply) => {
            const partner = await requirePartner(request);
            const { id } = request.params;
            const body = z.object({ lat: z.number().optional(), lng: z.number().optional() }).parse(request.body ?? {});
            const route = await routePlannerService.optimizeRoute({ agentType: 'partner', partnerId: partner.id }, id, body.lat, body.lng);
            return reply.send({ ok: true, route });
        });
    });
    app.post('/api/v1/enroll/partner', async (request, reply) => {
        const body = z
            .object({
            phone: z.string().min(10),
            name: z.string().optional(),
            partnerCode: z.string().optional(),
            qrToken: z.string().optional(),
        })
            .parse(request.body);
        const result = await partnerEnrollmentService.enrollByPhone(body);
        return reply.send({ ok: true, ...result });
    });
    app.get('/api/v1/enroll/partner/:code', async (request, reply) => {
        const { code } = request.params;
        const partner = await partnerService.getByCode(code);
        if (!partner)
            return reply.code(404).send({ ok: false, message: 'Partner not found' });
        return reply.send({
            ok: true,
            partner: {
                partnerCode: partner.partnerCode,
                fullName: partner.fullName,
                district: partner.district,
                state: partner.state,
            },
        });
    });
}
//# sourceMappingURL=partner-api.routes.js.map