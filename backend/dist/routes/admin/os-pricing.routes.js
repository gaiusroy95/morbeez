import { z } from 'zod';
import { assertModuleAccess, assertStaffManagement } from '../../lib/rbac.js';
import { pricingConfigService } from '../../services/pricing/pricing-config.service.js';
import { safePriceEngineService } from '../../services/pricing/safe-price-engine.service.js';
import { incentiveEngineService } from '../../services/pricing/incentive-engine.service.js';
import { employeePerformanceService } from '../../services/pricing/employee-performance.service.js';
import { employeeKpiService } from '../../services/pricing/employee-kpi.service.js';
import { bulkMarginReviewService } from '../../services/pricing/bulk-margin-review.service.js';
import { employeeEarningsService } from '../../services/pricing/employee-earnings.service.js';
export async function osPricingRoutes(app) {
    const api = '/morbeez-staff/api/v1/os/pricing';
    app.get(`${api}/config`, async (request, reply) => {
        await assertModuleAccess(request, 'commerce', 'read');
        const config = await pricingConfigService.getConfig();
        return reply.send({ ok: true, config });
    });
    app.put(`${api}/config`, async (request, reply) => {
        await assertModuleAccess(request, 'commerce', 'write');
        const body = z.record(z.union([z.number(), z.string(), z.boolean()])).parse(request.body);
        const config = await pricingConfigService.updateConfig(body);
        return reply.send({ ok: true, config });
    });
    app.get(`${api}/tiers`, async (request, reply) => {
        await assertModuleAccess(request, 'telecaller_crm', 'read');
        const q = request.query;
        const tiers = await safePriceEngineService.resolveByVariantOrSku({
            variantId: q.variantId,
            sku: q.sku,
            catalogListedPrice: q.listedPrice ? Number(q.listedPrice) : undefined,
        });
        return reply.send({
            ok: true,
            employee: safePriceEngineService.toEmployeeView(tiers),
        });
    });
    app.post(`${api}/preview`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
        const body = z
            .object({
            orderType: z.enum(['standard', 'bulk', 'clearance', 'strategic', 'liquidation']).optional(),
            lines: z
                .array(z.object({
                variantId: z.coerce.number().optional(),
                sku: z.string().optional(),
                title: z.string().optional(),
                qty: z.coerce.number().int().positive(),
                unitPrice: z.coerce.number().positive(),
                catalogListedPrice: z.coerce.number().optional(),
            }))
                .min(1),
        })
            .parse(request.body);
        const preview = await incentiveEngineService.previewQuote({
            lines: body.lines,
            orderType: body.orderType,
            adminUserId: admin.id,
        });
        return reply.send({
            ok: true,
            preview: {
                lines: preview.lines.map((l) => ({
                    variantId: l.variantId,
                    sku: l.sku,
                    title: l.title,
                    qty: l.qty,
                    listedPrice: l.listedPrice,
                    sellingPrice: l.sellingPrice,
                    recommendedPrice: l.recommendedPrice,
                    safePrice: l.safePrice,
                    hardFloorPrice: l.hardFloorPrice,
                    realizationPct: l.realizationPct,
                    incentiveTotal: l.incentiveTotal,
                    warningLevel: l.warningLevel,
                    warningMessage: l.warningMessage,
                    allowed: l.allowed,
                })),
                retailOrBulk: preview.retailOrBulk,
                orderTotal: preview.orderTotal,
                totalIncentive: preview.totalIncentive,
                avgRealizationPct: preview.avgRealizationPct,
                baseIncentivePct: preview.baseIncentivePct,
                realizationMultiplier: preview.realizationMultiplier,
                monthlyAchievementPct: preview.monthlyAchievementPct,
                monthlyMtdSalesInr: preview.monthlyMtdSalesInr,
                bulkGrossMarginPct: preview.bulkGrossMarginPct,
                performanceHint: preview.performanceHint,
                warnings: preview.warnings,
                needsOwnerReview: preview.needsOwnerReview,
                hardFloorBlocked: preview.hardFloorBlocked,
            },
        });
    });
    app.get(`${api}/bulk-reviews/pending`, async (request, reply) => {
        assertStaffManagement(request);
        const reviews = await bulkMarginReviewService.listPending();
        return reply.send({ ok: true, reviews });
    });
    app.post(`${api}/bulk-reviews/:id/approve`, async (request, reply) => {
        const admin = assertStaffManagement(request);
        const { id } = request.params;
        const body = z.object({ notes: z.string().optional() }).parse(request.body ?? {});
        const review = await bulkMarginReviewService.approve(id, admin.id, body.notes);
        return reply.send({ ok: true, review });
    });
    app.post(`${api}/bulk-reviews/:id/reject`, async (request, reply) => {
        const admin = assertStaffManagement(request);
        const { id } = request.params;
        const body = z.object({ notes: z.string().optional() }).parse(request.body ?? {});
        const review = await bulkMarginReviewService.reject(id, admin.id, body.notes);
        return reply.send({ ok: true, review });
    });
    app.get(`${api}/kpi/dashboard`, async (request, reply) => {
        assertStaffManagement(request);
        const q = request.query;
        const dashboard = await employeeKpiService.getDashboard(q.monthYear, q.filter ?? 'all');
        return reply.send({ ok: true, ...dashboard });
    });
    app.post(`${api}/kpi/recompute`, async (request, reply) => {
        assertStaffManagement(request);
        const body = z.object({ monthYear: z.string().optional() }).parse(request.body ?? {});
        await employeeKpiService.recomputeAllForMonth(body.monthYear);
        return reply.send({ ok: true });
    });
    app.get(`${api}/performance/dashboard`, async (request, reply) => {
        assertStaffManagement(request);
        const q = request.query;
        const kpi = await employeeKpiService.getDashboard(q.monthYear, q.filter ?? 'all');
        return reply.send({ ok: true, ...kpi });
    });
    app.get(`${api}/earnings/me`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
        const earnings = await employeeEarningsService.getMyEarnings(admin.id);
        if (!earnings) {
            return reply.status(404).send({ ok: false, error: 'No employee profile linked to this account' });
        }
        return reply.send({ ok: true, earnings });
    });
    app.get(`${api}/performance/me`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
        const performance = await employeePerformanceService.getMyPerformance(admin.id);
        return reply.send({ ok: true, performance });
    });
}
//# sourceMappingURL=os-pricing.routes.js.map