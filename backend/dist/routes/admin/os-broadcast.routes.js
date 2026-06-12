import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { broadcastCampaignService } from '../../services/whatsapp/broadcasts/broadcast-campaign.service.js';
const audienceSchema = z.object({
    cropTypes: z.array(z.string()).optional(),
    districts: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    broadcastTags: z.array(z.string()).optional(),
    farmerCategories: z.array(z.string()).optional(),
});
const categorySchema = z.enum([
    'cultivation_advisory',
    'fertigation_reminder',
    'pest_disease_alert',
    'weather_alert',
    'market_price_update',
    'custom_message',
]);
export async function osBroadcastRoutes(app) {
    const api = '/morbeez-staff/api/v1/os/broadcasts';
    app.get(`${api}/campaigns`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const q = request.query;
        const campaigns = await broadcastCampaignService.listCampaigns({
            status: q.status,
            limit: q.limit ? Number(q.limit) : undefined,
        });
        return reply.send({ ok: true, campaigns });
    });
    app.get(`${api}/campaigns/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const { id } = request.params;
        const campaign = await broadcastCampaignService.getCampaign(id);
        return reply.send({ ok: true, campaign });
    });
    app.post(`${api}/campaigns`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'operations', 'write');
        const body = z
            .object({
            name: z.string().min(1).max(200),
            category: categorySchema,
            audienceJson: audienceSchema.optional(),
            messageTitle: z.string().max(500).optional(),
            messageBody: z.string().max(8000).optional(),
            languageMode: z.string().optional(),
            mediaUrls: z.array(z.string()).optional(),
            templateId: z.string().uuid().optional(),
        })
            .parse(request.body);
        const campaign = await broadcastCampaignService.createCampaign({
            ...body,
            createdBy: admin.email,
        });
        return reply.status(201).send({ ok: true, campaign });
    });
    app.patch(`${api}/campaigns/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const body = z
            .object({
            name: z.string().min(1).max(200).optional(),
            category: categorySchema.optional(),
            audienceJson: audienceSchema.optional(),
            messageTitle: z.string().max(500).optional(),
            messageBody: z.string().max(8000).optional(),
            languageMode: z.string().optional(),
            mediaUrls: z.array(z.string()).optional(),
            status: z.string().optional(),
            scheduledAt: z.string().nullable().optional(),
        })
            .parse(request.body);
        const campaign = await broadcastCampaignService.updateCampaign(id, body);
        return reply.send({ ok: true, campaign });
    });
    app.post(`${api}/audience/preview`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const body = z.object({ audienceJson: audienceSchema }).parse(request.body);
        const preview = await broadcastCampaignService.previewAudience(body.audienceJson);
        return reply.send({ ok: true, ...preview });
    });
    app.post(`${api}/campaigns/:id/preview-audience`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const { id } = request.params;
        const campaign = await broadcastCampaignService.getCampaign(id);
        const preview = await broadcastCampaignService.previewAudience(campaign.audienceJson);
        return reply.send({ ok: true, ...preview });
    });
    app.post(`${api}/campaigns/:id/preview-message`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const { id } = request.params;
        const body = z.object({ farmerId: z.string().uuid().optional() }).parse(request.body ?? {});
        const preview = await broadcastCampaignService.previewMessage(id, body.farmerId);
        return reply.send({ ok: true, preview });
    });
    app.post(`${api}/campaigns/:id/send`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const body = z.object({ dryRun: z.boolean().optional() }).parse(request.body ?? {});
        const result = await broadcastCampaignService.sendCampaign(id, body);
        return reply.send({ ok: true, result });
    });
    app.post(`${api}/campaigns/:id/schedule`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const body = z.object({ scheduledAt: z.string().min(1) }).parse(request.body);
        const campaign = await broadcastCampaignService.scheduleCampaign(id, body.scheduledAt);
        return reply.send({ ok: true, campaign });
    });
    app.post(`${api}/campaigns/:id/submit`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const campaign = await broadcastCampaignService.submitForApproval(id);
        return reply.send({ ok: true, campaign });
    });
    app.post(`${api}/campaigns/:id/approve`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const campaign = await broadcastCampaignService.approveCampaign(id, admin.email);
        return reply.send({ ok: true, campaign });
    });
    app.post(`${api}/campaigns/:id/cancel`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const campaign = await broadcastCampaignService.cancelCampaign(id);
        return reply.send({ ok: true, campaign });
    });
    app.get(`${api}/templates`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const q = request.query;
        const templates = await broadcastCampaignService.listTemplates({ status: q.status });
        return reply.send({ ok: true, templates });
    });
    app.post(`${api}/templates`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'operations', 'write');
        const body = z
            .object({
            name: z.string().min(1).max(200),
            category: z.string().min(1),
            cropType: z.string().optional(),
            targetDap: z.number().int().optional(),
            title: z.string().max(500).optional(),
            body: z.string().min(1).max(8000),
            language: z.string().optional(),
            mediaUrls: z.array(z.string()).optional(),
        })
            .parse(request.body);
        const template = await broadcastCampaignService.createTemplate({
            ...body,
            createdBy: admin.email,
        });
        return reply.status(201).send({ ok: true, template });
    });
    app.patch(`${api}/templates/:id`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const body = z
            .object({
            name: z.string().optional(),
            body: z.string().optional(),
            title: z.string().optional(),
            status: z.enum(['draft', 'pending_approval', 'approved', 'archived']).optional(),
        })
            .parse(request.body);
        const template = await broadcastCampaignService.updateTemplate(id, {
            ...body,
            approvedBy: body.status === 'approved' ? admin.email : undefined,
        });
        return reply.send({ ok: true, template });
    });
    app.post(`${api}/templates/:id/clone-to-campaign`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'operations', 'write');
        const { id } = request.params;
        const campaign = await broadcastCampaignService.cloneTemplateToCampaign(id, admin.email);
        return reply.status(201).send({ ok: true, campaign });
    });
    app.get(`${api}/deliveries/export`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const q = request.query;
        const csv = await broadcastCampaignService.exportDeliveriesCsv({
            campaignId: q.campaignId,
            limit: q.limit ? Number(q.limit) : undefined,
        });
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="broadcast-deliveries.csv"');
        return reply.send(csv);
    });
    app.get(`${api}/dashboard`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const [campaigns, templates, scheduled] = await Promise.all([
            broadcastCampaignService.listCampaigns({ limit: 10 }),
            broadcastCampaignService.listTemplates({ status: 'approved' }),
            broadcastCampaignService.listCampaigns({ status: 'scheduled', limit: 20 }),
        ]);
        return reply.send({
            ok: true,
            recentCampaigns: campaigns,
            approvedTemplates: templates.slice(0, 20),
            scheduledCampaigns: scheduled,
        });
    });
    app.get(`${api}/analytics`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const q = request.query;
        const analytics = await broadcastCampaignService.getCampaignAnalytics({
            campaignId: q.campaignId,
            days: q.days ? Number(q.days) : undefined,
        });
        return reply.send({ ok: true, analytics });
    });
    app.get(`${api}/approvals/pending`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const pending = await broadcastCampaignService.listPendingApprovals();
        return reply.send({ ok: true, ...pending });
    });
    app.get(`${api}/preferences/:farmerId`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'read');
        const { farmerId } = request.params;
        const preferences = await broadcastCampaignService.getFarmerPreferences(farmerId);
        return reply.send({ ok: true, preferences });
    });
    app.patch(`${api}/preferences/:farmerId`, async (request, reply) => {
        await assertModuleAccess(request, 'operations', 'write');
        const { farmerId } = request.params;
        const body = z
            .object({
            optedOutAll: z.boolean().optional(),
            optedOutCategories: z.array(z.string()).optional(),
        })
            .parse(request.body);
        const preferences = await broadcastCampaignService.updateFarmerPreferences(farmerId, body);
        return reply.send({ ok: true, preferences });
    });
}
//# sourceMappingURL=os-broadcast.routes.js.map