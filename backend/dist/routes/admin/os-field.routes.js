import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { fieldPwaService } from '../../services/admin/field-pwa.service.js';
import { fieldVisitService } from '../../services/admin/field-visit.service.js';
import { fieldFindingsMastersService } from '../../services/admin/field-findings-masters.service.js';
import { issueFollowUpQuestionsService } from '../../services/core/issue-follow-up-questions.service.js';
import { visitAiOrchestratorService } from '../../services/core/visit-ai-orchestrator.service.js';
import { visitCaseClosureService } from '../../services/core/visit-case-closure.service.js';
import { trainingExportService } from '../../services/core/training-export.service.js';
import { agronomistMobileService } from '../../services/agronomist/agronomist-mobile.service.js';
import { recommendationCompatibilityService } from '../../services/core/recommendation-compatibility.service.js';
import { recommendationCommunicationService } from '../../services/core/recommendation-communication.service.js';
import { monitoringPlanService } from '../../services/core/monitoring-plan.service.js';
import { visitPhotoValidationService } from '../../services/core/visit-photo-validation.service.js';
import { visitEnvironmentService } from '../../services/core/visit-environment.service.js';
import { structuredFieldVisitSchema, issueCategorySchema, visitAiContextRequestSchema, visitAnalyzeRequestSchema, visitAnalyzeVisitRequestSchema, visitMonitoringPreviewSchema, visitWhatsappPreviewSchema, visitAiAnswersBodySchema, visitAiRecommendBodySchema, visitAiRejectBodySchema, recommendationOutcomeSchema, } from '../../domain/ai-training/validators.js';
const photoSchema = z.object({
    filename: z.string().min(1).max(200),
    mimeType: z.string().min(3).max(80),
    dataBase64: z.string().min(10).max(7_000_000),
});
export async function osFieldRoutes(app) {
    const api = '/morbeez-staff/api/v1/os/field';
    app.get(`${api}/farmers/search`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = request.query;
        const farmers = await fieldPwaService.searchFarmers(q.q ?? '', q.limit ? Number(q.limit) : 20);
        return reply.send({ ok: true, farmers });
    });
    app.get(`${api}/farmers/:farmerId/blocks`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const blocks = await fieldPwaService.getFarmerBlocks(farmerId);
        return reply.send({ ok: true, blocks });
    });
    app.post(`${api}/blocks/:blockId/location`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { blockId } = request.params;
        const body = z
            .object({
            farmerId: z.string().uuid(),
            latitude: z.number().min(6).max(37.5),
            longitude: z.number().min(68).max(97.5),
        })
            .parse(request.body);
        const block = await fieldPwaService.saveBlockLocation({
            blockId,
            farmerId: body.farmerId,
            latitude: body.latitude,
            longitude: body.longitude,
        });
        return reply.send({ ok: true, block });
    });
    app.get(`${api}/questionnaire/:cropType`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { cropType } = request.params;
        const questions = await fieldPwaService.getQuestionnaire(cropType);
        return reply.send({ ok: true, questions });
    });
    app.get(`${api}/visits/recent`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'read');
        const q = request.query;
        const visits = await fieldPwaService.listRecentVisits(admin.email, q.limit ? Number(q.limit) : 15, q.farmerId);
        return reply.send({ ok: true, visits });
    });
    app.post(`${api}/visits`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = z
            .object({
            farmerId: z.string().uuid(),
            blockId: z.string().uuid(),
            blockName: z.string().min(1),
            cropType: z.string().min(1),
            leadId: z.string().uuid().optional(),
            observations: z.string().max(8000).optional(),
            diseasePest: z.string().max(500).optional(),
            diseaseTone: z.enum(['healthy', 'warning', 'danger']).optional(),
            actionTaken: z.string().max(2000).optional(),
            answers: z
                .array(z.object({
                questionKey: z.string(),
                label: z.string(),
                value: z.string(),
            }))
                .default([]),
            photos: z.array(photoSchema).max(8).optional(),
            latitude: z.number().min(6).max(37.5).optional(),
            longitude: z.number().min(68).max(97.5).optional(),
        })
            .parse(request.body);
        const result = await fieldPwaService.submitVisit({
            ...body,
            agronomistName: admin.email,
            agronomistEmail: admin.email,
        });
        return reply.status(201).send({ ok: true, ...result });
    });
    app.post(`${api}/visits/sessions`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = z
            .object({
            farmerId: z.string().uuid(),
            blockId: z.string().uuid().optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
        })
            .parse(request.body);
        const session = await agronomistMobileService.startVisitSession({
            ...body,
            agronomistEmail: admin.email,
        });
        return reply.status(201).send({ ok: true, session });
    });
    app.patch(`${api}/visits/sessions/:sessionId/check-out`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { sessionId } = request.params;
        const body = z
            .object({
            latitude: z.number().optional(),
            longitude: z.number().optional(),
            fieldFindingId: z.string().uuid().optional(),
        })
            .parse(request.body ?? {});
        const session = await agronomistMobileService.checkOutVisitSession(sessionId, body);
        return reply.send({ ok: true, session });
    });
    app.get(`${api}/issue-master`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = request.query;
        const items = await fieldVisitService.listIssueMaster({
            category: q.category ? issueCategorySchema.parse(q.category) : undefined,
            cropType: q.cropType,
            q: q.q,
            limit: q.limit ? Number(q.limit) : 100,
        });
        return reply.send({ ok: true, items });
    });
    app.get(`${api}/measurement-templates/:cropType`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { cropType } = request.params;
        const templates = await fieldVisitService.listMeasurementTemplates(cropType);
        return reply.send({ ok: true, templates });
    });
    app.get(`${api}/visits/:findingId`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { findingId } = request.params;
        const detail = await fieldVisitService.getVisitDetail(findingId);
        return reply.send({ ok: true, ...detail });
    });
    app.post(`${api}/visits/:findingId/close-case`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { findingId } = request.params;
        const body = z
            .object({
            outcome: recommendationOutcomeSchema.optional(),
            notes: z.string().max(4000).optional(),
            learningConsent: z.boolean().optional(),
            issueResolved: z.boolean().optional(),
        })
            .parse(request.body ?? {});
        const result = await visitCaseClosureService.closeCase({
            fieldFindingId: findingId,
            closedBy: admin.email,
            outcome: body.outcome,
            notes: body.notes,
            learningConsent: body.learningConsent,
            issueResolved: body.issueResolved,
        });
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/visits/:findingId/training-bundle`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { findingId } = request.params;
        const bundle = await trainingExportService.exportVisitCaseBundle(findingId);
        return reply.send({ ok: true, bundle });
    });
    app.get(`${api}/farmers/:farmerId/field-findings`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const q = z
            .object({
            limit: z.coerce.number().int().min(1).max(50).optional(),
            status: z.enum(['open', 'monitoring', 'resolved']).optional(),
            blockId: z.string().uuid().optional(),
        })
            .parse(request.query ?? {});
        const findings = await fieldVisitService.listFarmerFieldFindings(farmerId, {
            limit: q.limit ?? 30,
            status: q.status,
            blockId: q.blockId,
        });
        return reply.send({ ok: true, findings });
    });
    app.post(`${api}/visits/v2`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = structuredFieldVisitSchema.parse(request.body);
        const result = await fieldVisitService.submitStructuredVisit(body, admin.email);
        return reply.status(201).send({ ok: true, ...result });
    });
    app.post(`${api}/visits/context`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const body = visitAiContextRequestSchema.parse(request.body);
        const context = await visitAiOrchestratorService.buildContext(body);
        return reply.send({ ok: true, context });
    });
    app.get(`${api}/visits/environment`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z
            .object({ farmerId: z.string().uuid(), blockId: z.string().uuid() })
            .parse(request.query ?? {});
        const environment = await visitEnvironmentService.getEnvironment(q.farmerId, q.blockId);
        return reply.send({ ok: true, ...environment });
    });
    app.post(`${api}/visits/photos/validate`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const body = z
            .object({
            dataBase64: z.string().min(10).max(7_000_000),
            mimeType: z.string().optional(),
        })
            .parse(request.body);
        const result = visitPhotoValidationService.validateBase64(body.dataBase64, body.mimeType);
        return reply.send(result);
    });
    app.post(`${api}/visits/analyze`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = visitAnalyzeRequestSchema.parse(request.body);
        const result = await visitAiOrchestratorService.analyze(body, admin.email);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/visits/analyze-visit`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = visitAnalyzeVisitRequestSchema.parse(request.body);
        const result = await visitAiOrchestratorService.analyzeVisit(body, admin.email);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/visits/monitoring-plan/preview`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const body = visitMonitoringPreviewSchema.parse(request.body);
        const items = monitoringPlanService.previewForVisit(body);
        return reply.send({ ok: true, items });
    });
    app.post(`${api}/visits/whatsapp-preview`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const body = visitWhatsappPreviewSchema.parse(request.body);
        const messages = await recommendationCommunicationService.previewVisitMessages(body);
        return reply.send({ ok: true, messages });
    });
    app.get(`${api}/visits/ai-case/:aiCaseId/questions`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { aiCaseId } = request.params;
        const questions = await visitAiOrchestratorService.getQuestions(aiCaseId);
        return reply.send({ ok: true, questions });
    });
    app.post(`${api}/visits/ai-case/:aiCaseId/questions`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { aiCaseId } = request.params;
        const body = visitAiAnswersBodySchema.parse(request.body);
        const result = await visitAiOrchestratorService.saveAnswers(aiCaseId, body);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/visits/ai-case/:aiCaseId/reanalyze`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { aiCaseId } = request.params;
        const result = await visitAiOrchestratorService.reanalyze(aiCaseId);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/visits/ai-case/:aiCaseId/skip-qa`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { aiCaseId } = request.params;
        const result = await visitAiOrchestratorService.skipFollowUp(aiCaseId);
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/visits/ai-case/:aiCaseId`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { aiCaseId } = request.params;
        const detail = await visitAiOrchestratorService.getCaseDetail(aiCaseId);
        return reply.send({ ok: true, case: detail });
    });
    app.post(`${api}/visits/ai-case/:aiCaseId/recommend`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { aiCaseId } = request.params;
        const body = visitAiRecommendBodySchema.parse(request.body ?? {});
        const result = await visitAiOrchestratorService.recommend(aiCaseId, body.finalDiagnosis);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/visits/ai-case/:aiCaseId/reject`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const { aiCaseId } = request.params;
        const body = visitAiRejectBodySchema.parse(request.body);
        const result = await visitAiOrchestratorService.rejectRecommendation(aiCaseId, body, admin.email);
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/visits/similar-cases`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z
            .object({
            farmerId: z.string().uuid(),
            cropType: z.string().min(1),
            issueName: z.string().min(1),
        })
            .parse(request.query ?? {});
        const cases = await visitAiOrchestratorService.similarCases(q.farmerId, q.cropType, q.issueName);
        return reply.send({ ok: true, cases });
    });
    app.get(`${api}/visits/case-library`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const q = z
            .object({
            cropType: z.string().optional(),
            issue: z.string().optional(),
            outcome: z.string().optional(),
            dapBucket: z.string().optional(),
            severity: z.string().optional(),
            reviewAction: z.string().optional(),
            limit: z.coerce.number().int().min(1).max(100).optional(),
        })
            .parse(request.query ?? {});
        const cases = await visitAiOrchestratorService.searchCaseLibrary(q);
        return reply.send({ ok: true, cases });
    });
    app.post(`${api}/issue-follow-up-questions`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const body = z
            .object({
            issueCategory: issueCategorySchema,
            issueName: z.string().min(1),
            cropType: z.string().min(1),
            dap: z.number().optional(),
            observation: z.string().optional(),
            recommendationText: z.string().optional(),
            photoCount: z.number().optional(),
        })
            .parse(request.body);
        const questions = await issueFollowUpQuestionsService.suggest(body);
        return reply.send({ ok: true, questions });
    });
    app.post(`${api}/visits/recommendations/compatibility-check`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const body = z
            .object({
            productA: z.string().min(1).max(200).optional(),
            productB: z.string().min(1).max(200).optional(),
            materials: z
                .array(z.object({
                technicalName: z.string().min(1).max(200),
            }))
                .max(30)
                .optional(),
        })
            .superRefine((data, ctx) => {
            const hasPair = Boolean(data.productA?.trim() && data.productB?.trim());
            const hasMaterials = Boolean(data.materials?.length);
            if (!hasPair && !hasMaterials) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'Provide productA/productB or materials',
                    path: ['materials'],
                });
            }
        })
            .parse(request.body);
        if (body.productA && body.productB) {
            const result = await recommendationCompatibilityService.checkPair(body.productA, body.productB);
            return reply.send({ ok: true, pair: result });
        }
        const report = await recommendationCompatibilityService.checkMaterials(body.materials ?? []);
        return reply.send({ ok: true, ...report });
    });
    app.post(`${api}/masters/issue`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const body = z
            .object({
            category: issueCategorySchema,
            issueName: z.string().min(1),
            conceptCode: z.string().optional(),
            cropType: z.string().optional(),
            sortOrder: z.number().optional(),
        })
            .parse(request.body);
        const row = await fieldFindingsMastersService.createIssueMaster(body);
        return reply.status(201).send({ ok: true, row });
    });
    app.patch(`${api}/masters/issue/:id/deactivate`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const { id } = request.params;
        const result = await fieldFindingsMastersService.deactivateIssueMaster(id);
        return reply.send(result);
    });
    app.post(`${api}/masters/measurement-template`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'write');
        const body = z
            .object({
            cropType: z.string().min(1),
            measurementKey: z.string().min(1),
            labelEn: z.string().min(1),
            unit: z.string().optional(),
            inputType: z.string().optional(),
            sortOrder: z.number().optional(),
        })
            .parse(request.body);
        const row = await fieldFindingsMastersService.upsertMeasurementTemplate(body);
        return reply.status(201).send({ ok: true, row });
    });
}
//# sourceMappingURL=os-field.routes.js.map