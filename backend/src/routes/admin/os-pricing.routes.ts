import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assertModuleAccess, assertStaffManagement } from '../../lib/rbac.js';
import { pricingConfigService } from '../../services/pricing/pricing-config.service.js';
import { safePriceEngineService } from '../../services/pricing/safe-price-engine.service.js';
import { incentiveEngineService } from '../../services/pricing/incentive-engine.service.js';
import { employeePerformanceService } from '../../services/pricing/employee-performance.service.js';

export async function osPricingRoutes(app: FastifyInstance): Promise<void> {
  const api = '/morbeez-staff/api/v1/os/pricing';

  app.get(`${api}/config`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'read');
    const config = await pricingConfigService.getConfig();
    return reply.send({ ok: true, config });
  });

  app.put(`${api}/config`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'write');
    const body = z
      .object({
        targetGrossMarginPct: z.number().optional(),
        recommendedPctOfListed: z.number().optional(),
        safeMarginPctOfGross: z.number().optional(),
        hardFloorMarginPctOfGross: z.number().optional(),
        incentiveFactor: z.number().optional(),
        platformCostPct: z.number().optional(),
        adAllocationPct: z.number().optional(),
        returnRiskPct: z.number().optional(),
        realizationExcellent: z.number().optional(),
        realizationGood: z.number().optional(),
        realizationWarning: z.number().optional(),
        bulkBonus25k: z.number().optional(),
        bulkBonus50k: z.number().optional(),
        bulkBonus100k: z.number().optional(),
      })
      .parse(request.body);
    const config = await pricingConfigService.updateConfig(body);
    return reply.send({ ok: true, config });
  });

  app.get(`${api}/tiers`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const q = request.query as { variantId?: string; sku?: string; listedPrice?: string };
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
          .array(
            z.object({
              variantId: z.coerce.number().optional(),
              sku: z.string().optional(),
              title: z.string().optional(),
              qty: z.coerce.number().int().positive(),
              unitPrice: z.coerce.number().positive(),
              catalogListedPrice: z.coerce.number().optional(),
            })
          )
          .min(1),
      })
      .parse(request.body);

    const preview = await incentiveEngineService.previewQuote({
      lines: body.lines,
      orderType: body.orderType,
      adminUserId: admin.id,
    });

    const employeeLines = preview.lines.map((l) => ({
      variantId: l.variantId,
      sku: l.sku,
      title: l.title,
      qty: l.qty,
      listedPrice: l.listedPrice,
      sellingPrice: l.sellingPrice,
      recommendedPrice: l.recommendedPrice,
      hardFloorPrice: l.hardFloorPrice,
      realizationPct: l.realizationPct,
      incentiveTotal: l.incentiveTotal,
      warningLevel: l.warningLevel,
      warningMessage: l.warningMessage,
      allowed: l.allowed,
    }));

    return reply.send({
      ok: true,
      preview: {
        lines: employeeLines,
        subtotalIncentive: preview.subtotalIncentive,
        totalIncentive: preview.totalIncentive,
        bulkOrderBonus: preview.bulkOrderBonus,
        avgRealizationPct: preview.avgRealizationPct,
        performanceHint: preview.performanceHint,
        warnings: preview.warnings,
        orderTotal: preview.orderTotal,
      },
    });
  });

  app.get(`${api}/performance/dashboard`, async (request, reply) => {
    assertStaffManagement(request);
    const q = request.query as { date?: string; period?: 'daily' | 'weekly' };
    const dashboard = await employeePerformanceService.getDashboard({
      date: q.date,
      period: q.period,
    });
    return reply.send({ ok: true, ...dashboard });
  });

  app.get(`${api}/performance/me`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'telecaller_crm', 'read');
    const performance = await employeePerformanceService.getMyPerformance(admin.id);
    return reply.send({ ok: true, performance });
  });
}
