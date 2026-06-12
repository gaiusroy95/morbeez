import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import {
  dateRangeFromDays,
  marketingPerformanceService,
} from '../../services/admin/marketing-performance.service.js';
import { marketingSpendService } from '../../services/admin/marketing-spend.service.js';
import { marketingMetaImportService } from '../../services/admin/marketing-meta-import.service.js';
import { LEAD_CHANNELS } from '../../domain/marketing/lead-attribution.js';

const leadChannelEnum = z.enum(LEAD_CHANNELS as unknown as [string, ...string[]]);

function parseQuery(q: {
  days?: string;
  from?: string;
  to?: string;
  ownerId?: string;
  campaign?: string;
  channel?: string;
}) {
  const days = q.days ? Number(q.days) : 30;
  const range =
    q.from && q.to ? { from: q.from, to: q.to } : dateRangeFromDays(Math.min(Math.max(days, 7), 90));
  return {
    ...range,
    ownerId: q.ownerId,
    campaign: q.campaign,
    channel: q.channel,
  };
}

export async function osMarketingRoutes(app: FastifyInstance): Promise<void> {
  const api = '/morbeez-staff/api/v1/marketing';

  app.get(`${api}/performance/overview`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'read');
    const q = parseQuery(request.query as Record<string, string | undefined>);
    const overview = await marketingPerformanceService.getOverview(q);
    return reply.send({ ok: true, ...overview });
  });

  app.get(`${api}/performance/by-marketer`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'read');
    const q = parseQuery(request.query as Record<string, string | undefined>);
    const marketers = await marketingPerformanceService.getByMarketer(q);
    return reply.send({ ok: true, marketers });
  });

  app.get(`${api}/performance/by-campaign`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'read');
    const q = parseQuery(request.query as Record<string, string | undefined>);
    const campaigns = await marketingPerformanceService.getByCampaign(q);
    return reply.send({ ok: true, campaigns });
  });

  app.get(`${api}/performance/queue-health`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const overview = await marketingPerformanceService.getOverview(
      dateRangeFromDays(7)
    );
    return reply.send({ ok: true, queueHealth: overview.queueHealth });
  });

  app.get(`${api}/owners`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const owners = await marketingPerformanceService.listMarketingOwners();
    return reply.send({ ok: true, owners });
  });

  app.get(`${api}/spend`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'read');
    const q = request.query as { monthYear?: string; from?: string; to?: string };
    if (q.from && q.to) {
      const entries = await marketingSpendService.listByDateRange(q.from, q.to);
      const total = entries.reduce((s, e) => s + Number(e.amount_inr), 0);
      return reply.send({ ok: true, total, entries });
    }
    const monthYear = q.monthYear ?? new Date().toISOString().slice(0, 7);
    const entries = await marketingSpendService.listByMonth(monthYear);
    const total = entries.reduce((s, e) => s + Number(e.amount_inr), 0);
    return reply.send({ ok: true, monthYear, total, entries });
  });

  app.post(`${api}/spend`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'commerce', 'write');
    const body = z
      .object({
        monthYear: z.string(),
        channel: z.enum(['meta', 'google', 'whatsapp', 'field', 'general', 'other']).default('meta'),
        amountInr: z.coerce.number().positive(),
        notes: z.string().optional(),
        campaignName: z.string().optional(),
        marketingOwnerId: z.string().uuid().nullable().optional(),
        spendDate: z.string().optional(),
      })
      .parse(request.body);
    const entry = await marketingSpendService.addEntry({
      monthYear: body.monthYear,
      channel: body.channel,
      amountInr: body.amountInr,
      notes: body.notes,
      campaignName: body.campaignName,
      marketingOwnerId: body.marketingOwnerId,
      spendDate: body.spendDate,
      recordedBy: admin.id,
    });
    return reply.status(201).send({ ok: true, entry });
  });

  app.post(`${api}/leads/import-meta-csv`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'write');
    const body = z
      .object({
        csv: z.string().min(10),
        leadChannel: leadChannelEnum.default('meta'),
        campaignSource: z.string().optional(),
        marketingOwnerId: z.string().uuid().nullable().optional(),
        marketingOwnerName: z.string().optional(),
      })
      .parse(request.body);
    const result = await marketingMetaImportService.importCsv(body.csv, {
      leadChannel: body.leadChannel,
      campaignSource: body.campaignSource,
      marketingOwnerId: body.marketingOwnerId,
      marketingOwnerName: body.marketingOwnerName,
    });
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/incentive-rules`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'read');
    const rules = await marketingSpendService.listIncentiveRules();
    return reply.send({ ok: true, rules });
  });

  app.patch(`${api}/incentive-rules/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'commerce', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        flatConnectedInr: z.coerce.number().min(0).optional(),
        flatBookedInr: z.coerce.number().min(0).optional(),
        flatPaidInr: z.coerce.number().min(0).optional(),
        monthlyCapInr: z.coerce.number().min(0).nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(request.body);
    const rule = await marketingSpendService.updateIncentiveRule(id, body);
    return reply.send({ ok: true, rule });
  });
}
