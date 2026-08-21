import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { partnerService } from '../../services/partner/partner.service.js';
import { partnerOnboardingService } from '../../services/partner/partner-onboarding.service.js';
import { partnerSettingsService } from '../../services/partner/partner-settings.service.js';
import { partnerKpiService } from '../../services/partner/partner-kpi.service.js';
import { partnerReliabilityService } from '../../services/partner/partner-reliability.service.js';
import { partnerLeadAllocationService } from '../../services/partner/partner-lead-allocation.service.js';
import { farmerOwnershipService } from '../../services/partner/farmer-ownership.service.js';
import { partnerAttributionCaptureService } from '../../services/partner/partner-attribution-capture.service.js';
import { commissionEngineService } from '../../services/partner/commission-engine.service.js';
import { partnerEventsService, partnerTerritoryService } from '../../services/partner/partner-events.service.js';
import { partnerTrainingService } from '../../services/partner/partner-training.service.js';
import { farmerTeamTimelineService } from '../../services/crm/farmer-team-timeline.service.js';
import { supabase } from '../../lib/supabase.js';
export async function osPartnerRoutes(app) {
    const api = '/morbeez-staff/api/v1/partners';
    app.get(`${api}`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = request.query;
        const partners = await partnerService.list({
            status: q.status,
            tier: q.tier,
        });
        return reply.send({ ok: true, partners });
    });
    app.get(`${api}/earning-rules`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const { earningRulesService } = await import('../../services/remuneration/earning-rules.service.js');
        const rules = await earningRulesService.list();
        return reply.send({ ok: true, rules });
    });
    app.get(`${api}/settlements`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = request.query;
        let query = supabase.from('earning_settlements').select('*').order('payable_on', { ascending: true }).limit(200);
        if (q.partyType === 'partner' || q.partyType === 'employee')
            query = query.eq('party_type', q.partyType);
        if (q.partyId)
            query = query.eq('party_id', q.partyId);
        const { data } = await query;
        return reply.send({ ok: true, settlements: data ?? [] });
    });
    app.get(`${api}/introductions`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = request.query;
        const { farmerIntroductionService } = await import('../../services/remuneration/farmer-introduction.service.js');
        const introductions = await farmerIntroductionService.list({
            partnerId: q.partnerId,
            status: q.status,
        });
        return reply.send({ ok: true, introductions });
    });
    app.post(`${api}/introductions/:id/refresh`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const { farmerIntroductionService } = await import('../../services/remuneration/farmer-introduction.service.js');
        const row = await farmerIntroductionService.refresh(id);
        return reply.send({ ok: true, introduction: row });
    });
    app.get(`${api}/payouts`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = request.query;
        const { partnerPayoutService } = await import('../../services/partner/partner-payout.service.js');
        const batches = await partnerPayoutService.list(q.month);
        return reply.send({ ok: true, batches });
    });
    app.post(`${api}/payouts/generate`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const body = z.object({ month: z.string().optional() }).parse(request.body ?? {});
        const { partnerPayoutService } = await import('../../services/partner/partner-payout.service.js');
        const result = await partnerPayoutService.generateMonth(body.month);
        return reply.send({ ok: true, ...result, generatedBy: admin.email });
    });
    app.post(`${api}/payouts/:id/approve`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const { partnerPayoutService } = await import('../../services/partner/partner-payout.service.js');
        const batch = await partnerPayoutService.approve(id, admin.email);
        return reply.send({ ok: true, batch });
    });
    app.post(`${api}/payouts/:id/mark-paid`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const { partnerPayoutService } = await import('../../services/partner/partner-payout.service.js');
        const batch = await partnerPayoutService.markPaid(id);
        return reply.send({ ok: true, batch });
    });
    app.get(`${api}/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const { id } = request.params;
        const partner = await partnerService.getById(id);
        return reply.send({ ok: true, partner });
    });
    app.get(`${api}/:id/360`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const { id } = request.params;
        const partner = await partnerService.getById(id);
        const { farmerIntroductionService } = await import('../../services/remuneration/farmer-introduction.service.js');
        const introductions = await farmerIntroductionService.list({ partnerId: id });
        let settlements = [];
        {
            const { data } = await supabase
                .from('earning_settlements')
                .select('*')
                .eq('party_type', 'partner')
                .eq('party_id', id)
                .order('payable_on', { ascending: false })
                .limit(100);
            settlements = (data ?? []);
        }
        const { data: kpiSnapshots } = await supabase
            .from('partner_kpi_snapshots')
            .select('*')
            .eq('partner_id', id)
            .order('period_start', { ascending: false })
            .limit(12);
        return reply.send({ ok: true, partner, introductions, settlements, kpiSnapshots });
    });
    app.post(`${api}`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const body = z
            .object({
            fullName: z.string().min(2),
            phone: z.string().min(10),
            email: z.string().email().optional(),
            state: z.string().optional(),
            district: z.string().optional(),
            village: z.string().optional(),
            languages: z.array(z.string()).optional(),
            experienceNotes: z.string().optional(),
            metadata: z.record(z.unknown()).optional(),
            createAppAccount: z.boolean().optional(),
            sendActivation: z.boolean().optional(),
        })
            .parse(request.body);
        const result = await partnerOnboardingService.createPartnerByAdmin(body, admin.email);
        return reply.code(201).send({ ok: true, ...result });
    });
    app.post(`${api}/:id/send-activation`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const activation = await partnerOnboardingService.sendActivationInvite(id);
        return reply.send({ ok: true, activation });
    });
    app.get(`${api}/applications/list`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = request.query;
        const applications = await partnerOnboardingService.listApplications(q.status);
        return reply.send({ ok: true, applications });
    });
    app.post(`${api}/applications`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const body = z
            .object({
            fullName: z.string().min(2),
            phone: z.string().min(10),
            email: z.string().email().optional(),
            state: z.string().optional(),
            district: z.string().optional(),
            village: z.string().optional(),
            languages: z.array(z.string()).optional(),
            experienceNotes: z.string().optional(),
            metadata: z.record(z.unknown()).optional(),
            createAppAccount: z.boolean().optional(),
            sendActivation: z.boolean().optional(),
        })
            .parse(request.body);
        // Staff "Create Partner" must create a real partner row + send activation,
        // not only a pending application (which never appears in Partners list).
        const result = await partnerOnboardingService.createPartnerByAdmin(body, admin.email);
        return reply.code(201).send({ ok: true, ...result });
    });
    app.post(`${api}/applications/:id/approve`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const result = await partnerOnboardingService.approveApplication(id, admin.email);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/applications/:id/reject`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const body = z.object({ notes: z.string().optional() }).parse(request.body ?? {});
        const application = await partnerOnboardingService.rejectApplication(id, admin.email, body.notes);
        return reply.send({ ok: true, application });
    });
    app.patch(`${api}/:id/status`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const body = z
            .object({
            status: z.enum(['verified', 'training', 'certified', 'active', 'suspended', 'inactive']),
            reason: z.string().min(1),
        })
            .parse(request.body);
        const partner = await partnerService.updateStatus(id, body.status, body.reason, admin.email);
        return reply.send({ ok: true, partner });
    });
    app.patch(`${api}/:id/tier`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const body = z
            .object({ tier: z.enum(['associate', 'certified', 'senior', 'master']) })
            .parse(request.body);
        const partner = await partnerService.updateTier(id, body.tier, admin.email);
        return reply.send({ ok: true, partner });
    });
    app.get(`${api}/settings/list`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const settings = await partnerSettingsService.list();
        return reply.send({ ok: true, settings });
    });
    app.put(`${api}/settings/:key`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { key } = request.params;
        const body = z.object({ value: z.record(z.unknown()) }).parse(request.body);
        const setting = await partnerSettingsService.upsert(key, body.value, admin.email);
        return reply.send({ ok: true, setting });
    });
    app.post(`${api}/:id/recompute-reliability`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const result = await partnerReliabilityService.recomputeScore(id);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/:id/compute-kpi`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const snapshot = await partnerKpiService.computeMonthlySnapshot(id, start, now);
        const tier = await partnerKpiService.maybePromoteTier(id);
        return reply.send({ ok: true, snapshot, tier });
    });
    app.post(`${api}/leads/:leadId/allocate`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { leadId } = request.params;
        const body = z.object({ farmerId: z.string().uuid().optional() }).parse(request.body ?? {});
        const allocations = await partnerLeadAllocationService.allocateLeadToPartners(leadId, body.farmerId);
        return reply.send({ ok: true, allocations });
    });
    app.get(`${api}/farmers/:farmerId/ownership`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const { farmerId } = request.params;
        const ownership = await farmerOwnershipService.getOwnership(farmerId);
        const attributions = await partnerAttributionCaptureService.listForFarmer(farmerId);
        return reply.send({ ok: true, ownership, attributions });
    });
    app.post(`${api}/farmers/:farmerId/assign`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { farmerId } = request.params;
        const body = z
            .object({
            partnerId: z.string().uuid(),
            serviceModel: z.enum(['partner_assisted', 'remote_advisory']).optional(),
            reason: z.string().max(500).optional(),
        })
            .parse(request.body);
        const ownership = await farmerOwnershipService.changeCustomerOwner({
            farmerId,
            customerOwnerType: 'partner',
            customerOwnerPartnerId: body.partnerId,
            serviceModel: body.serviceModel ?? 'partner_assisted',
            assignedPartnerId: body.partnerId,
            reason: body.reason ?? 'admin_manual_assign',
            changedBy: admin.email,
        });
        await partnerAttributionCaptureService.upsertTouch({
            farmerId,
            partnerId: body.partnerId,
            attributionType: 'enrollment',
            metadata: { source: 'admin_assign', changedBy: admin.email },
        });
        const { farmerIntroductionService } = await import('../../services/remuneration/farmer-introduction.service.js');
        await farmerIntroductionService.createFromEnrollment({
            farmerId,
            partnerId: body.partnerId,
            source: 'admin_assign',
        });
        const attributions = await partnerAttributionCaptureService.listForFarmer(farmerId);
        return reply.send({ ok: true, ownership, attributions });
    });
    app.post(`${api}/tasks`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const body = z
            .object({
            farmerId: z.string().uuid(),
            partnerId: z.string().uuid(),
            title: z.string().min(1),
            taskCategory: z.string().default('visit_request'),
            dueAt: z.string().optional(),
            notes: z.string().optional(),
        })
            .parse(request.body);
        const { data, error } = await supabase
            .from('crm_tasks')
            .insert({
            farmer_id: body.farmerId,
            title: body.title,
            task_type: 'visit',
            task_category: body.taskCategory,
            status: 'pending',
            assigned_partner_id: body.partnerId,
            created_by: admin.email,
            due_at: body.dueAt ?? null,
            notes: body.notes ?? null,
        })
            .select('*')
            .single();
        if (error)
            throw error;
        return reply.code(201).send({ ok: true, task: data });
    });
    app.get(`${api}/commission/list`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const rules = await commissionEngineService.listMaster();
        return reply.send({ ok: true, rules });
    });
    app.put(`${api}/commission/:categoryKey`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { categoryKey } = request.params;
        const body = z
            .object({
            ruleType: z.enum(['fixed_pct', 'fixed_inr', 'lead_bonus_only', 'none']),
            ratePct: z.number().optional(),
            fixedInr: z.number().optional(),
            requiresOwnership: z.boolean().optional(),
            requiresReliabilityMin: z.number().optional(),
        })
            .parse(request.body);
        const { data, error } = await supabase
            .from('commission_master')
            .upsert({
            category_key: categoryKey,
            rule_type: body.ruleType,
            rate_pct: body.ratePct ?? null,
            fixed_inr: body.fixedInr ?? null,
            requires_ownership: body.requiresOwnership ?? true,
            requires_reliability_min: body.requiresReliabilityMin ?? 50,
            is_active: true,
            updated_at: new Date().toISOString(),
            updated_by: admin.email,
        }, { onConflict: 'category_key' })
            .select('*')
            .single();
        if (error)
            throw error;
        return reply.send({ ok: true, rule: data });
    });
    app.get(`${api}/events/list`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = request.query;
        const events = await partnerEventsService.list(q.partnerId);
        return reply.send({ ok: true, events });
    });
    app.post(`${api}/events/:id/approve`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const event = await partnerEventsService.approve(id, admin.email);
        return reply.send({ ok: true, event });
    });
    app.get(`${api}/training/modules`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const modules = await partnerTrainingService.listModules();
        return reply.send({ ok: true, modules });
    });
    app.patch(`${api}/applications/:id/stage`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const body = z
            .object({ stage: z.string().min(1), notes: z.string().optional() })
            .parse(request.body);
        const application = await partnerOnboardingService.advanceStage(id, body.stage, admin.email, body.notes);
        return reply.send({ ok: true, application });
    });
    app.get(`${api}/control-tower/:farmerId`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const { farmerId } = request.params;
        const ownership = await farmerOwnershipService.getOwnership(farmerId);
        const attributions = await partnerAttributionCaptureService.listForFarmer(farmerId);
        const timeline = await farmerTeamTimelineService.listForFarmer(farmerId, 50);
        const { data: farmer } = await supabase
            .from('farmers')
            .select('name, phone, village, district, assigned_crop_advisor_email, assigned_expert_email')
            .eq('id', farmerId)
            .maybeSingle();
        let partnerReliability = null;
        let fraudSignals = [];
        const partnerId = ownership?.assignedPartnerId ?? ownership?.customerOwnerPartnerId;
        if (partnerId) {
            const { data: partnerRow } = await supabase
                .from('partners')
                .select('id, full_name, reliability_score, performance_score, status, tier')
                .eq('id', partnerId)
                .maybeSingle();
            partnerReliability = partnerRow;
            const { data: signals } = await supabase
                .from('partner_reliability_signals')
                .select('*')
                .eq('partner_id', partnerId)
                .in('signal_type', ['fraud_flag', 'gps_missing', 'late_checkout'])
                .order('created_at', { ascending: false })
                .limit(20);
            fraudSignals = (signals ?? []);
        }
        return reply.send({
            ok: true,
            farmer,
            ownership,
            attributions,
            timeline,
            partnerReliability,
            fraudSignals,
        });
    });
    app.post(`${api}/:id/territory`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const body = z
            .object({ pincode: z.string().min(6).max(6), isPrimary: z.boolean().optional() })
            .parse(request.body);
        const row = await partnerTerritoryService.upsertPincode(id, body.pincode, body.isPrimary);
        return reply.send({ ok: true, territory: row });
    });
}
//# sourceMappingURL=os-partner.routes.js.map