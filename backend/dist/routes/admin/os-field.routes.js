import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { fieldPwaService } from '../../services/admin/field-pwa.service.js';
import { fieldVisitService } from '../../services/admin/field-visit.service.js';
import { fieldFindingsMastersService } from '../../services/admin/field-findings-masters.service.js';
import { issueFollowUpQuestionsService } from '../../services/core/issue-follow-up-questions.service.js';
import { agronomistMobileService } from '../../services/agronomist/agronomist-mobile.service.js';
import { structuredFieldVisitSchema, issueCategorySchema, } from '../../domain/ai-training/validators.js';
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
    app.get(`${api}/farmers/:farmerId/field-findings`, async (request, reply) => {
        await assertModuleAccess(request, 'agronomist', 'read');
        const { farmerId } = request.params;
        const q = request.query;
        const findings = await fieldVisitService.listFarmerFieldFindings(farmerId, q.limit ? Number(q.limit) : 30);
        return reply.send({ ok: true, findings });
    });
    app.post(`${api}/visits/v2`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'agronomist', 'write');
        const body = structuredFieldVisitSchema.parse(request.body);
        const result = await fieldVisitService.submitStructuredVisit(body, admin.email);
        return reply.status(201).send({ ok: true, ...result });
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