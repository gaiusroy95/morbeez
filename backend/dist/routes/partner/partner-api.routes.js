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
            const { partnerEarningsService } = await import('../../services/partner/partner-earnings.service.js');
            const summary = await partnerEarningsService.getSummary(partner.id);
            return reply.send({ ok: true, summary });
        });
        partnerApp.get(`${api}/earnings/ledger`, async (request, reply) => {
            const partner = await requirePartner(request);
            const q = request.query;
            const { partnerEarningsService } = await import('../../services/partner/partner-earnings.service.js');
            const ledger = await partnerEarningsService.listLedger(partner.id, q.month);
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
            const items = await fieldFindingsMastersService.listIssueMaster(q.cropType ? { cropType: q.cropType } : undefined);
            return reply.send({ ok: true, items });
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