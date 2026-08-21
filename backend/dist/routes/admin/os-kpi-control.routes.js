import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { logAdminMutation } from '../../lib/admin-mutation-audit.js';
import { RULE_TYPES } from '../../domain/remuneration/rule-workflow.js';
import { earningRulesService } from '../../services/remuneration/earning-rules.service.js';
import { qualifiedCaseEngine } from '../../services/remuneration/qualified-case.engine.js';
import { diagnosisQaService } from '../../services/remuneration/diagnosis-qa.service.js';
import { agronomistKpiService } from '../../services/remuneration/agronomist-kpi.service.js';
import { partnerKpiService } from '../../services/partner/partner-kpi.service.js';
import { monthKey } from '../../domain/remuneration/rule-workflow.js';
const monthSchema = z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM')
    .optional();
export async function osKpiControlRoutes(app) {
    const api = '/morbeez-staff/api/v1/kpi-control';
    app.get(`${api}/rules`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const rules = await earningRulesService.list();
        return reply.send({ ok: true, rules, ruleTypes: RULE_TYPES });
    });
    app.post(`${api}/rules`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const body = z
            .object({
            ruleType: z.enum(RULE_TYPES),
            payload: z.record(z.unknown()),
            effectiveFrom: z.string().min(8),
            changeReason: z.string().min(3).max(500),
        })
            .parse(request.body);
        const row = await earningRulesService.createVersion({
            ruleType: body.ruleType,
            payload: body.payload,
            effectiveFrom: body.effectiveFrom,
            changeReason: body.changeReason,
            createdBy: admin.email,
        });
        await logAdminMutation({
            actorId: admin.id,
            actorEmail: admin.email,
            action: 'create',
            resource: 'earning_rule_versions',
            resourceId: row.id,
            details: { ruleType: body.ruleType, version: row.version_number },
        });
        return reply.send({ ok: true, rule: row });
    });
    app.patch(`${api}/rules/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const body = z
            .object({
            payload: z.record(z.unknown()).optional(),
            effectiveFrom: z.string().min(8).optional(),
            changeReason: z.string().min(3).max(500).optional(),
        })
            .parse(request.body);
        const row = await earningRulesService.updateDraft(id, body);
        return reply.send({ ok: true, rule: row });
    });
    app.post(`${api}/rules/:id/submit`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const row = await earningRulesService.transition(id, 'submitted', admin.email);
        return reply.send({ ok: true, rule: row });
    });
    app.post(`${api}/rules/:id/approve`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const row = await earningRulesService.transition(id, 'approved', admin.email);
        await logAdminMutation({
            actorId: admin.id,
            actorEmail: admin.email,
            action: 'update',
            resource: 'earning_rule_versions',
            resourceId: id,
            details: { status: 'approved' },
        });
        return reply.send({ ok: true, rule: row });
    });
    app.post(`${api}/rules/:id/schedule`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const row = await earningRulesService.transition(id, 'scheduled', admin.email);
        return reply.send({ ok: true, rule: row });
    });
    app.post(`${api}/rules/:id/activate`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const row = await earningRulesService.transition(id, 'active', admin.email);
        await logAdminMutation({
            actorId: admin.id,
            actorEmail: admin.email,
            action: 'update',
            resource: 'earning_rule_versions',
            resourceId: id,
            details: { status: 'active', ruleType: row.rule_type, version: row.version_number },
        });
        return reply.send({ ok: true, rule: row });
    });
    app.get(`${api}/locks`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = z.object({ month: monthSchema }).parse(request.query);
        const locks = await earningRulesService.listLocks(q.month);
        return reply.send({ ok: true, locks });
    });
    app.post(`${api}/locks/freeze`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const body = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(request.body);
        const locks = await earningRulesService.freezeMonth(body.month, admin.email);
        await qualifiedCaseEngine.scanMonth(body.month, 400);
        await diagnosisQaService.ensureSample(body.month);
        await logAdminMutation({
            actorId: admin.id,
            actorEmail: admin.email,
            action: 'update',
            resource: 'kpi_period_locks',
            details: { month: body.month, locks: locks.length },
        });
        return reply.send({ ok: true, locks });
    });
    app.get(`${api}/qualified-cases`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = z
            .object({
            month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
            qualified: z.enum(['true', 'false']).optional(),
        })
            .parse(request.query);
        const month = q.month ?? monthKey();
        const cases = await qualifiedCaseEngine.list(month, q.qualified == null ? undefined : q.qualified === 'true');
        return reply.send({
            ok: true,
            month,
            cases,
            qualified: cases.filter((c) => c.qualified).length,
            total: cases.length,
        });
    });
    app.post(`${api}/qualified-cases/scan`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const body = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(request.body ?? {});
        const month = body.month ?? monthKey();
        const result = await qualifiedCaseEngine.scanMonth(month, 400);
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/diagnosis-qa`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = z.object({ month: monthSchema }).parse(request.query);
        const month = q.month ?? monthKey();
        const [samples, summary] = await Promise.all([
            diagnosisQaService.list(month),
            diagnosisQaService.summary(month),
        ]);
        return reply.send({ ok: true, month, samples, summary });
    });
    app.post(`${api}/diagnosis-qa/draw`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const body = z
            .object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional(), force: z.boolean().optional() })
            .parse(request.body ?? {});
        const month = body.month ?? monthKey();
        const result = await diagnosisQaService.draw(month, body.force === true);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/diagnosis-qa/:id/audit`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { id } = request.params;
        const body = z
            .object({
            status: z.enum(['accurate', 'inaccurate', 'skipped']),
            notes: z.string().max(1000).optional(),
        })
            .parse(request.body);
        const row = await diagnosisQaService.audit(id, {
            status: body.status,
            notes: body.notes,
            auditor: admin.email,
        });
        return reply.send({ ok: true, sample: row });
    });
    app.get(`${api}/agronomist-snapshots`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const q = z.object({ month: monthSchema }).parse(request.query);
        const month = q.month ?? monthKey();
        const snapshots = await agronomistKpiService.list(month);
        return reply.send({ ok: true, month, snapshots });
    });
    app.post(`${api}/recompute`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const body = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(request.body ?? {});
        const month = body.month ?? monthKey();
        const [partners, agronomists] = await Promise.all([
            partnerKpiService.recomputeAllForMonth(month),
            agronomistKpiService.recomputeMonth(month),
        ]);
        return reply.send({
            ok: true,
            month,
            partners: partners.length,
            agronomists: agronomists.length,
        });
    });
    app.get(`${api}/fraud-flags`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const { fraudFlagService } = await import('../../services/remuneration/fraud-flag.service.js');
        const q = z
            .object({
            status: z.enum(['open', 'confirmed', 'cleared']).optional(),
            partyType: z.enum(['partner', 'employee']).optional(),
            partyId: z.string().uuid().optional(),
        })
            .parse(request.query);
        const flags = await fraudFlagService.list(q);
        return reply.send({ ok: true, flags });
    });
    app.post(`${api}/fraud-flags`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { fraudFlagService } = await import('../../services/remuneration/fraud-flag.service.js');
        const { FRAUD_FLAG_TYPES } = await import('../../domain/remuneration/fraud-hold.js');
        const body = z
            .object({
            partyType: z.enum(['partner', 'employee']),
            partyId: z.string().uuid(),
            flagType: z.enum(FRAUD_FLAG_TYPES),
            reason: z.string().min(3).max(500),
            earningSource: z.enum(['partner_ledger', 'agronomist_ledger', 'order', 'introduction']).optional(),
            earningId: z.string().uuid().optional(),
            orderId: z.string().uuid().optional(),
            farmerId: z.string().uuid().optional(),
        })
            .parse(request.body);
        const flag = await fraudFlagService.open({ ...body, openedBy: admin.email });
        await logAdminMutation({
            actorId: admin.id,
            actorEmail: admin.email,
            action: 'create',
            resource: 'earning_fraud_flags',
            resourceId: flag?.id ? String(flag.id) : undefined,
            details: { partyType: body.partyType, partyId: body.partyId },
        });
        return reply.send({ ok: true, flag });
    });
    app.post(`${api}/fraud-flags/:id/confirm`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { fraudFlagService } = await import('../../services/remuneration/fraud-flag.service.js');
        const { id } = request.params;
        const flag = await fraudFlagService.setStatus(id, 'confirmed', admin.email);
        return reply.send({ ok: true, flag });
    });
    app.post(`${api}/fraud-flags/:id/clear`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { fraudFlagService } = await import('../../services/remuneration/fraud-flag.service.js');
        const { id } = request.params;
        const flag = await fraudFlagService.setStatus(id, 'cleared', admin.email);
        return reply.send({ ok: true, flag });
    });
    app.post(`${api}/fraud-flags/scan`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'write');
        const { fraudFlagService } = await import('../../services/remuneration/fraud-flag.service.js');
        const result = await fraudFlagService.scan(80);
        return reply.send({ ok: true, ...result });
    });
    app.get(`${api}/disputes`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const { disputeService } = await import('../../services/remuneration/dispute.service.js');
        const q = z
            .object({
            status: z.enum(['open', 'upheld', 'rejected']).optional(),
            partyType: z.enum(['partner', 'employee']).optional(),
            partyId: z.string().uuid().optional(),
        })
            .parse(request.query);
        const disputes = await disputeService.list(q);
        return reply.send({ ok: true, disputes });
    });
    app.post(`${api}/disputes`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { disputeService } = await import('../../services/remuneration/dispute.service.js');
        const body = z
            .object({
            partyType: z.enum(['partner', 'employee']),
            partyId: z.string().uuid(),
            earningSource: z.enum(['partner_ledger', 'agronomist_ledger']),
            earningId: z.string().uuid(),
            amountInr: z.coerce.number().positive(),
            reason: z.string().min(3).max(500),
            orderId: z.string().uuid().optional(),
        })
            .parse(request.body);
        const dispute = await disputeService.open({ ...body, openedBy: admin.email });
        await logAdminMutation({
            actorId: admin.id,
            actorEmail: admin.email,
            action: 'create',
            resource: 'earning_disputes',
            resourceId: String(dispute.id),
        });
        return reply.send({ ok: true, dispute });
    });
    app.post(`${api}/disputes/:id/uphold`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { disputeService } = await import('../../services/remuneration/dispute.service.js');
        const { id } = request.params;
        const body = z.object({ notes: z.string().max(1000).optional() }).parse(request.body ?? {});
        const dispute = await disputeService.resolve(id, 'upheld', admin.email, body.notes);
        return reply.send({ ok: true, dispute });
    });
    app.post(`${api}/disputes/:id/reject`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'partner_program', 'write');
        const { disputeService } = await import('../../services/remuneration/dispute.service.js');
        const { id } = request.params;
        const body = z.object({ notes: z.string().max(1000).optional() }).parse(request.body ?? {});
        const dispute = await disputeService.resolve(id, 'rejected', admin.email, body.notes);
        return reply.send({ ok: true, dispute });
    });
    app.get(`${api}/drilldown`, async (request, reply) => {
        await assertModuleAccess(request, 'partner_program', 'read');
        const { earningDrilldownService } = await import('../../services/remuneration/earning-drilldown.service.js');
        const q = z
            .object({
            partyType: z.enum(['partner', 'employee']),
            partyId: z.string().uuid(),
        })
            .parse(request.query);
        const drilldown = await earningDrilldownService.forParty(q.partyType, q.partyId);
        return reply.send({ ok: true, ...drilldown });
    });
}
//# sourceMappingURL=os-kpi-control.routes.js.map