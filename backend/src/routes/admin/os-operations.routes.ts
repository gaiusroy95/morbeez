import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { assertModuleAccess } from '../../lib/rbac.js';
import {
  assertAdminPasswordConfirm,
  assertSuperAdminPasswordConfirm,
  confirmPasswordSchema,
} from '../../lib/super-admin-password.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { whatsappBroadcastAdminService } from '../../services/admin/whatsapp-broadcast-admin.service.js';
import { runRoiDailyPromptsNow } from '../../services/whatsapp/roi/roi-daily-prompt.worker.js';
import { whatsappOsAdminService } from '../../services/admin/whatsapp-os-admin.service.js';
import { crmFarmerService, type MasterType } from '../../services/admin/crm-farmer.service.js';
import { operationsMessagingService } from '../../services/admin/operations-messaging.service.js';
import { terminologyAdminService } from '../../services/admin/terminology-admin.service.js';
import {
  fetchWeatherForecast,
  resolveCoords,
} from '../../services/whatsapp/pipeline/weather-fetch.service.js';

const broadcastKindEnum = z.enum([
  'cultivation_schedule',
  'fertigation_reminder',
  'pgr_broadcast',
  'dap_task',
  'cultivation_knowledge',
]);

export async function osOperationsRoutes(app: FastifyInstance): Promise<void> {
  const api = '/morbeez-staff/api/v1/os/operations';

  app.get(`${api}/messaging-config`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    return reply.send({
      ok: true,
      config: {
        provider: env.WHATSAPP_PROVIDER,
        broadcastsEnabled: env.ENABLE_WHATSAPP_BROADCASTS,
        broadcastMaxPerDay: env.WHATSAPP_BROADCAST_MAX_PER_DAY,
        broadcastKindCooldownHours: env.WHATSAPP_BROADCAST_KIND_COOLDOWN_HOURS,
        sessionHours: env.WHATSAPP_SESSION_HOURS,
        cultivationFollowUpsEnabled: env.ENABLE_CULTIVATION_FOLLOW_UPS,
        advisoryFollowUpsEnabled: env.ENABLE_ADVISORY_FOLLOW_UPS,
        advisoryAutomationEnabled: env.ENABLE_ADVISORY_AUTOMATION,
        orderAlertsEnabled: env.ENABLE_WHATSAPP_ORDER_ALERTS,
      },
    });
  });

  app.get(`${api}/broadcasts/rules`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const rules = await whatsappBroadcastAdminService.listRules();
    return reply.send({ ok: true, rules });
  });

  app.get(`${api}/broadcasts/deliveries`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { farmerId?: string; limit?: string };
    const deliveries = await whatsappBroadcastAdminService.listDeliveries({
      farmerId: q.farmerId,
      limit: q.limit ? Number(q.limit) : 50,
    });
    return reply.send({ ok: true, deliveries });
  });

  app.post(`${api}/broadcasts/run`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        farmerId: z.string().uuid().optional(),
        dryRun: z.boolean().optional(),
        kinds: z.array(broadcastKindEnum).optional(),
      })
      .parse(request.body ?? {});
    const result = await whatsappBroadcastAdminService.runBroadcasts(body);
    return reply.send({ ok: true, result });
  });

  app.post(`${api}/roi/daily-prompts/run`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        farmerId: z.string().uuid().optional(),
        dryRun: z.boolean().optional(),
      })
      .parse(request.body ?? {});
    const result = await runRoiDailyPromptsNow(body);
    return reply.send({ ok: true, result });
  });

  app.post(`${api}/broadcasts/rules`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        id: z.string().uuid().optional(),
        cropType: z.string().min(1),
        broadcastKind: broadcastKindEnum,
        targetDap: z.number().int().nullable().optional(),
        dapTolerance: z.number().int().optional(),
        minDap: z.number().int().nullable().optional(),
        maxDap: z.number().int().nullable().optional(),
        weekday: z.number().int().min(1).max(7).nullable().optional(),
        priority: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .parse(request.body);
    const rule = await whatsappBroadcastAdminService.upsertRule(body);
    return reply.send({ ok: true, rule });
  });

  app.delete(`${api}/broadcasts/rules/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const { error } = await supabase
      .from('crop_dap_broadcast_rules')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfSupabaseError(error, 'Could not archive broadcast rule');
    return reply.send({ ok: true });
  });

  app.get(`${api}/crop-prices`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { crop?: string };
    const prices = await whatsappOsAdminService.listCropDailyPrices(q.crop);
    return reply.send({ ok: true, prices });
  });

  app.post(`${api}/crop-prices`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        cropType: z.string().min(1),
        marketName: z.string().min(1),
        district: z.string().optional(),
        pricePerKg: z.number().positive(),
        lastYearPricePerKg: z.number().positive().optional(),
        priceDate: z.string().optional(),
      })
      .parse(request.body);
    const row = await whatsappOsAdminService.upsertCropDailyPrice(body);
    return reply.send({ ok: true, price: row });
  });

  app.delete(`${api}/crop-prices/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const { error } = await supabase
      .from('crop_daily_prices')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfSupabaseError(error, 'Could not archive crop price');
    return reply.send({ ok: true });
  });

  app.get(`${api}/crop-markets`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    const crops = await farmerMarketPortalService.adminListCropMarkets();
    return reply.send({ ok: true, crops });
  });

  app.post(`${api}/crop-markets`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        id: z.string().uuid().optional(),
        cropName: z.string().min(1),
        icon: z.string().nullable().optional(),
        activeStatus: z.boolean().optional(),
        displayOrder: z.number().int().optional(),
      })
      .parse(request.body);
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    const crop = await farmerMarketPortalService.adminUpsertCropMarket(body);
    return reply.send({ ok: true, crop });
  });

  app.delete(`${api}/crop-markets/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    await farmerMarketPortalService.adminArchiveCropMarket(id);
    return reply.send({ ok: true });
  });

  app.get(`${api}/field-activities/blocks`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { limit?: string };
    const blocks = await whatsappOsAdminService.listFieldActivityBlocks(
      q.limit ? Number(q.limit) : 100
    );
    return reply.send({ ok: true, blocks });
  });

  app.patch(`${api}/field-activities/blocks/:id/location`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .parse(request.body);
    const block = await whatsappOsAdminService.updateFieldBlockLocation({
      blockId: id,
      latitude: body.latitude,
      longitude: body.longitude,
    });
    return reply.send({ ok: true, block });
  });

  app.get(`${api}/field-activities`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = z
      .object({
        blockId: z.string().uuid(),
        limit: z.coerce.number().int().positive().max(300).optional(),
      })
      .parse(request.query ?? {});
    const activities = await whatsappOsAdminService.listFieldActivities({
      blockId: q.blockId,
      limit: q.limit,
    });
    return reply.send({ ok: true, activities });
  });

  app.get(`${api}/field-activity-types`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = z
      .object({
        cropType: z.string().optional(),
        activeOnly: z.coerce.boolean().optional(),
      })
      .parse(request.query ?? {});
    const types = await whatsappOsAdminService.listFieldActivityTypes({
      cropType: q.cropType,
      activeOnly: q.activeOnly,
    });
    return reply.send({ ok: true, types });
  });

  app.post(`${api}/field-activity-types`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        activityName: z.string().min(1).max(120),
        category: z.string().max(40).optional(),
        crop: z.string().max(40).nullable().optional(),
        icon: z.string().max(40).nullable().optional(),
        colorTag: z.string().max(40).nullable().optional(),
        followupDefaultDays: z.number().int().min(0).max(365).nullable().optional(),
      })
      .parse(request.body);
    const type = await whatsappOsAdminService.createFieldActivityType(body);
    return reply.status(201).send({ ok: true, type });
  });

  app.patch(`${api}/field-activity-types/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        activityName: z.string().min(1).max(120).optional(),
        category: z.string().max(40).optional(),
        crop: z.string().max(40).nullable().optional(),
        icon: z.string().max(40).nullable().optional(),
        colorTag: z.string().max(40).nullable().optional(),
        followupDefaultDays: z.number().int().min(0).max(365).nullable().optional(),
        confirmPassword: confirmPasswordSchema,
      })
      .parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertSuperAdminPasswordConfirm(actor, confirmPassword);
    const type = await whatsappOsAdminService.updateFieldActivityType(id, patch);
    return reply.send({ ok: true, type });
  });

  app.delete(`${api}/field-activity-types/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    const type = await whatsappOsAdminService.deleteFieldActivityType(id);
    return reply.send({ ok: true, type });
  });

  app.get(`${api}/roi-expense-types`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const types = await cropSeasonService.adminListExpenseTypes();
    return reply.send({ ok: true, types });
  });

  app.post(`${api}/roi-expense-types`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        expenseName: z.string().min(1).max(80),
        icon: z.string().max(40).nullable().optional(),
        color: z.string().max(40).nullable().optional(),
        ledgerEntryType: z.enum(['labour', 'purchase', 'misc', 'harvest', 'income']).optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const type = await cropSeasonService.adminCreateExpenseType(body);
    return reply.status(201).send({ ok: true, type });
  });

  app.patch(`${api}/roi-expense-types/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        expenseName: z.string().min(1).max(80).optional(),
        icon: z.string().max(40).nullable().optional(),
        color: z.string().max(40).nullable().optional(),
        ledgerEntryType: z.enum(['labour', 'purchase', 'misc', 'harvest', 'income']).optional(),
        activeStatus: z.boolean().optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const type = await cropSeasonService.adminUpdateExpenseType(id, body);
    return reply.send({ ok: true, type });
  });

  app.delete(`${api}/roi-expense-types/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const type = await cropSeasonService.adminDeleteExpenseType(id);
    return reply.send({ ok: true, type });
  });

  app.get(`${api}/roi-labour-types`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const types = await cropSeasonService.adminListLabourTypes();
    return reply.send({ ok: true, types });
  });

  app.post(`${api}/roi-labour-types`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        labourName: z.string().min(1).max(80),
        icon: z.string().max(40).nullable().optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const type = await cropSeasonService.adminCreateLabourType(body);
    return reply.status(201).send({ ok: true, type });
  });

  app.patch(`${api}/roi-labour-types/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        labourName: z.string().min(1).max(80).optional(),
        icon: z.string().max(40).nullable().optional(),
        activeStatus: z.boolean().optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const type = await cropSeasonService.adminUpdateLabourType(id, body);
    return reply.send({ ok: true, type });
  });

  app.delete(`${api}/roi-labour-types/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const type = await cropSeasonService.adminDeleteLabourType(id);
    return reply.send({ ok: true, type });
  });

  app.get(`${api}/field-activities/pending-tasks`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = z
      .object({
        blockId: z.string().uuid(),
        limit: z.coerce.number().int().positive().max(300).optional(),
      })
      .parse(request.query ?? {});
    const tasks = await whatsappOsAdminService.listFieldPendingTasks({
      blockId: q.blockId,
      limit: q.limit,
    });
    return reply.send({ ok: true, tasks });
  });

  app.post(`${api}/field-activities`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        blockId: z.string().uuid(),
        activityTypeId: z.string().uuid().optional(),
        activityType: z.enum(['spray_applied', 'fertigation', 'drench', 'scouting', 'other']),
        activityLabel: z.string().max(120).optional(),
        activityDate: z.string().min(8).max(20),
        dap: z.number().int().min(0).max(5000).optional(),
        notes: z.string().max(1000).optional(),
        costInr: z.number().min(0).max(10000000).optional(),
        costBreakdown: z
          .object({
            labourCostInr: z.number().min(0).max(10000000).optional(),
            sprayCostInr: z.number().min(0).max(10000000).optional(),
            fertilizerCostInr: z.number().min(0).max(10000000).optional(),
            machineryCostInr: z.number().min(0).max(10000000).optional(),
          })
          .optional(),
        followUpRequired: z.boolean().optional(),
        followUpDate: z.string().min(8).max(20).optional(),
        status: z.enum(['completed', 'pending', 'cancelled']).optional(),
        assignedEmployee: z.string().max(160).optional(),
      })
      .parse(request.body);
    const activity = await whatsappOsAdminService.createFieldActivity(body);
    return reply.status(201).send({ ok: true, activity });
  });

  const fieldActivityPatchBody = z.object({
    activityTypeId: z.string().uuid().optional(),
    activityType: z.enum(['spray_applied', 'fertigation', 'drench', 'scouting', 'other']),
    activityLabel: z.string().max(120).optional(),
    activityDate: z.string().min(8).max(20),
    dap: z.number().int().min(0).max(5000).optional(),
    notes: z.string().max(1000).optional(),
    costInr: z.number().min(0).max(10000000).optional(),
    costBreakdown: z
      .object({
        labourCostInr: z.number().min(0).max(10000000).optional(),
        sprayCostInr: z.number().min(0).max(10000000).optional(),
        fertilizerCostInr: z.number().min(0).max(10000000).optional(),
        machineryCostInr: z.number().min(0).max(10000000).optional(),
      })
      .optional(),
    followUpRequired: z.boolean().optional(),
    followUpDate: z.string().min(8).max(20).optional(),
    status: z.enum(['completed', 'pending', 'cancelled']).optional(),
    confirmPassword: confirmPasswordSchema,
  });

  app.patch(`${api}/field-activities/:activityId`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'operations', 'write');
    const { activityId } = request.params as { activityId: string };
    const body = fieldActivityPatchBody.parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertAdminPasswordConfirm(actor, confirmPassword);
    const activity = await whatsappOsAdminService.updateFieldActivity(activityId, patch);
    return reply.send({ ok: true, activity });
  });

  app.delete(`${api}/field-activities/:activityId`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'operations', 'write');
    const { activityId } = request.params as { activityId: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertAdminPasswordConfirm(actor, body.confirmPassword);
    await whatsappOsAdminService.deleteFieldActivity(activityId);
    return reply.send({ ok: true });
  });

  app.get(`${api}/masters`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { type?: string; parentId?: string; search?: string };
    const type = z.string().min(1).parse(q.type ?? 'crop') as MasterType;
    const items = await crmFarmerService.listMasters(type, q.parentId || null, q.search);
    return reply.send({ ok: true, items });
  });

  app.post(`${api}/masters`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        masterType: z.string().min(1),
        name: z.string().min(1).max(120),
        parentId: z.string().uuid().nullable().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
      })
      .parse(request.body);
    const item = await crmFarmerService.createMaster({
      masterType: body.masterType as MasterType,
      name: body.name,
      parentId: body.parentId,
      category: body.category,
      description: body.description,
    });
    return reply.status(201).send({ ok: true, item });
  });

  app.patch(`${api}/masters/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        category: z.string().max(120).nullable().optional(),
        description: z.string().optional(),
        active: z.boolean().optional(),
        confirmPassword: confirmPasswordSchema,
      })
      .parse(request.body);
    const { confirmPassword, ...patch } = body;
    await assertSuperAdminPasswordConfirm(actor, confirmPassword);
    const item = await crmFarmerService.updateMaster(id, patch);
    return reply.send({ ok: true, item });
  });

  app.delete(`${api}/masters/:id`, async (request, reply) => {
    const actor = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ confirmPassword: confirmPasswordSchema }).parse(request.body ?? {});
    await assertSuperAdminPasswordConfirm(actor, body.confirmPassword);
    const item = await crmFarmerService.updateMaster(id, { active: false });
    return reply.send({ ok: true, item });
  });

  app.get(`${api}/market-options`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { cropType?: string };
    const markets = await whatsappOsAdminService.listMarketOptions(q.cropType);
    return reply.send({ ok: true, markets });
  });

  app.get(`${api}/weather/current`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = z
      .object({
        district: z.string().min(1).max(120).optional(),
      })
      .parse(request.query ?? {});
    const coords = resolveCoords({ district: q.district ?? null });
    const weather = await fetchWeatherForecast({
      lat: coords.lat,
      lon: coords.lon,
      label: coords.label,
    });
    return reply.send({ ok: true, weather });
  });

  app.get(`${api}/farmer-market-preferences`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = z
      .object({
        farmerId: z.string().uuid(),
        cropType: z.string().optional(),
      })
      .parse(request.query ?? {});
    const preferences = await whatsappOsAdminService.listFarmerMarketPreferences(q);
    return reply.send({ ok: true, preferences });
  });

  app.post(`${api}/farmer-market-preferences`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        farmerId: z.string().uuid(),
        cropType: z.string().optional(),
        markets: z
          .array(
            z.object({
              marketName: z.string().min(1).max(160),
              district: z.string().max(120).optional(),
            })
          )
          .max(10),
      })
      .parse(request.body);
    const preferences = await whatsappOsAdminService.saveFarmerMarketPreferences(body);
    return reply.send({ ok: true, preferences });
  });

  app.get(`${api}/terminology/tasks`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { status?: string; source?: string };
    const tasks = await whatsappOsAdminService.listTerminologyReviewTasks(
      q.status ?? 'open',
      q.source
    );
    return reply.send({ ok: true, tasks });
  });

  app.post(`${api}/terminology/tasks`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        term: z.string().min(1).max(120),
        rawMessage: z.string().max(500).optional(),
        language: z.string().max(10).optional(),
        cropType: z.string().max(80).optional(),
        district: z.string().max(120).optional(),
        farmerId: z.string().uuid().optional(),
        farmerPhone: z.string().max(20).optional(),
      })
      .parse(request.body);
    const task = await whatsappOsAdminService.createTerminologyReviewTask(body);
    return reply.status(201).send({ ok: true, task });
  });

  app.patch(`${api}/terminology/tasks/:id`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z.enum(['open', 'in_review', 'resolved', 'dismissed']),
        resolutionMeaning: z.string().max(500).optional(),
        standardTerm: z.string().max(200).optional(),
        assignedTo: z.string().max(120).optional(),
      })
      .parse(request.body);
    const task = await whatsappOsAdminService.updateTerminologyTask(id, {
      ...body,
      resolvedBy: admin.email,
    });
    return reply.send({ ok: true, task });
  });

  app.get(`${api}/terminology/summary`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const summary = await terminologyAdminService.getSummary();
    return reply.send({ ok: true, summary });
  });

  app.get(`${api}/terminology/concepts`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const concepts = await terminologyAdminService.listConcepts();
    return reply.send({ ok: true, concepts });
  });

  app.post(`${api}/terminology/concepts`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        name: z.string().min(1).max(200),
        category: z
          .enum(['general', 'disease', 'pest', 'nutrient_deficiency', 'growth_issue', 'weather_impact'])
          .optional(),
      })
      .parse(request.body);
    const concept = await terminologyAdminService.createConcept(body);
    return reply.status(201).send({ ok: true, concept });
  });

  app.get(`${api}/terminology/terms`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { search?: string; language?: string; district?: string };
    const terms = await terminologyAdminService.listRegionalTerms(q);
    return reply.send({ ok: true, terms });
  });

  app.patch(`${api}/terminology/tasks/:id/approve`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        conceptId: z.string().uuid().optional(),
        conceptName: z.string().max(200).optional(),
        conceptCategory: z
          .enum(['general', 'disease', 'pest', 'nutrient_deficiency', 'growth_issue', 'weather_impact'])
          .optional(),
        meaning: z.string().min(1).max(500),
        standardTerm: z.string().max(200).optional(),
        cropType: z.string().max(80).nullable().optional(),
        district: z.string().max(120).nullable().optional(),
        replyPreferred: z.boolean().optional(),
        examples: z.array(z.string()).optional(),
        aliases: z.array(z.string()).optional(),
      })
      .parse(request.body);
    const task = await terminologyAdminService.approveTask(id, {
      ...body,
      resolvedBy: admin.email,
    });
    return reply.send({ ok: true, task });
  });

  app.patch(`${api}/terminology/tasks/:id/skip`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const task = await terminologyAdminService.skipTask(id, admin.email);
    return reply.send({ ok: true, task });
  });

  app.patch(`${api}/terminology/tasks/:id/reject`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ reason: z.string().max(500).optional() }).parse(request.body ?? {});
    const task = await terminologyAdminService.rejectTask(id, admin.email, body.reason);
    return reply.send({ ok: true, task });
  });

  app.get(`${api}/terminology/learned`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { search?: string; language?: string; district?: string; status?: string };
    const terms = await terminologyAdminService.listLearnedTerminologies(q);
    return reply.send({ ok: true, terms });
  });

  app.get(`${api}/terminology/terms/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const { id } = request.params as { id: string };
    const term = await terminologyAdminService.getRegionalTerm(id);
    return reply.send({ ok: true, term });
  });

  app.patch(`${api}/terminology/terms/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        term: z.string().min(1).max(120).optional(),
        language: z.string().max(10).optional(),
        cropType: z.string().max(80).nullable().optional(),
        district: z.string().max(120).nullable().optional(),
        state: z.string().max(120).nullable().optional(),
        meaning: z.string().max(500).optional(),
        standardTerm: z.string().max(200).optional(),
        conceptId: z.string().uuid().nullable().optional(),
        replyPreferred: z.boolean().optional(),
        status: z.enum(['active', 'inactive']).optional(),
        aliases: z.array(z.string()).optional(),
      })
      .parse(request.body);
    const term = await terminologyAdminService.updateRegionalTerm(id, body);
    return reply.send({ ok: true, term });
  });

  app.get(`${api}/terminology/localization-profiles`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { language?: string; district?: string };
    const profiles = await terminologyAdminService.listLocalizationProfiles(q);
    return reply.send({ ok: true, profiles });
  });

  app.put(`${api}/terminology/localization-profiles`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        language: z.string().min(2).max(10),
        district: z.string().max(120).nullable().optional(),
        state: z.string().max(120).nullable().optional(),
        preferredTerms: z.array(z.unknown()).optional(),
        responseStyle: z.string().max(80).optional(),
      })
      .parse(request.body);
    const profile = await terminologyAdminService.upsertLocalizationProfile(body);
    return reply.send({ ok: true, profile });
  });

  app.get(`${api}/terminology/farmer-overrides`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { farmerId?: string; language?: string };
    const overrides = await terminologyAdminService.listFarmerOverrides(q);
    return reply.send({ ok: true, overrides });
  });

  app.put(`${api}/terminology/farmer-overrides`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        farmerId: z.string().uuid(),
        term: z.string().min(1).max(120),
        language: z.string().min(2).max(10),
        meaning: z.string().min(1).max(500),
        standardTerm: z.string().max(200).nullable().optional(),
        cropType: z.string().max(80).nullable().optional(),
        district: z.string().max(120).nullable().optional(),
      })
      .parse(request.body);
    const override = await terminologyAdminService.upsertFarmerOverride(body);
    return reply.send({ ok: true, override });
  });

  app.post(`${api}/terminology/farmer-overrides/promote`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        farmerId: z.string().uuid(),
        term: z.string().min(1).max(120),
        language: z.string().min(2).max(10),
        meaning: z.string().min(1).max(500),
        standardTerm: z.string().max(200).nullable().optional(),
        cropType: z.string().max(80).nullable().optional(),
        district: z.string().max(120).nullable().optional(),
      })
      .parse(request.body);
    const term = await terminologyAdminService.promoteFarmerOverride({
      ...body,
      approvedBy: admin.email,
    });
    return reply.send({ ok: true, term });
  });

  app.get(`${api}/terminology/product-aliases`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { status?: string; language?: string; search?: string };
    const aliases = await terminologyAdminService.listProductAliases(q);
    return reply.send({ ok: true, aliases });
  });

  app.post(`${api}/terminology/product-aliases`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        alias: z.string().min(1).max(120),
        language: z.string().min(2).max(10),
        canonicalProductKey: z.string().min(1).max(200),
        shopifyProductId: z.string().max(80).nullable().optional(),
        farmerId: z.string().uuid().nullable().optional(),
        cropType: z.string().max(80).nullable().optional(),
        district: z.string().max(120).nullable().optional(),
      })
      .parse(request.body);
    const alias = await terminologyAdminService.proposeProductAlias({
      ...body,
      proposedBy: admin.email,
    });
    return reply.status(201).send({ ok: true, alias });
  });

  app.patch(`${api}/terminology/product-aliases/:id`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z.enum(['approved', 'rejected', 'retired', 'pending']),
      })
      .parse(request.body);
    const alias = await terminologyAdminService.reviewProductAlias(id, body.status, admin.email);
    return reply.send({ ok: true, alias });
  });

  app.get(`${api}/terminology/unit-aliases`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { status?: string; language?: string; search?: string };
    const aliases = await terminologyAdminService.listUnitAliases(q);
    return reply.send({ ok: true, aliases });
  });

  app.post(`${api}/terminology/unit-aliases`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        alias: z.string().min(1).max(120),
        language: z.string().min(2).max(10),
        canonicalUnit: z.enum([
          'kg', 'g', 'litre', 'ml', 'quintal', 'tonne', 'bag', 'piece', 'hour', 'day', 'acre', 'other',
        ]),
        farmerId: z.string().uuid().nullable().optional(),
        cropType: z.string().max(80).nullable().optional(),
        district: z.string().max(120).nullable().optional(),
      })
      .parse(request.body);
    const alias = await terminologyAdminService.proposeUnitAlias({
      ...body,
      proposedBy: admin.email,
    });
    return reply.status(201).send({ ok: true, alias });
  });

  app.patch(`${api}/terminology/unit-aliases/:id`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z.enum(['approved', 'rejected', 'retired', 'pending']),
      })
      .parse(request.body);
    const alias = await terminologyAdminService.reviewUnitAlias(id, body.status, admin.email);
    return reply.send({ ok: true, alias });
  });

  app.get(`${api}/weather-rules`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const { data, error } = await supabase
      .from('weather_rule_definitions')
      .select('id, rule_key, version, crop_type, action_type, status, effective_from, approved_at')
      .order('rule_key')
      .limit(100);
    throwIfSupabaseError(error, 'Could not load weather rules');
    return reply.send({ ok: true, rules: data ?? [] });
  });

  app.get(`${api}/quick-replies`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { category?: string };
    const replies = await operationsMessagingService.listQuickReplies(q.category);
    return reply.send({ ok: true, replies });
  });

  app.post(`${api}/quick-replies`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        id: z.string().uuid().optional(),
        shortcutKey: z.string().min(1).max(60),
        category: z.enum(['general', 'telecaller', 'advisory', 'orders', 'broadcast']).optional(),
        labelEn: z.string().min(1),
        bodyEn: z.string().min(1),
        bodyMl: z.string().optional(),
        bodyTa: z.string().optional(),
        bodyKn: z.string().optional(),
        bodyHi: z.string().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(request.body);
    const reply_row = await operationsMessagingService.upsertQuickReply(body);
    return reply.send({ ok: true, reply: reply_row });
  });

  app.delete(`${api}/quick-replies/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    await operationsMessagingService.deleteQuickReply(id);
    return reply.send({ ok: true });
  });

  app.get(`${api}/language-templates`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as {
      templateKey?: string;
      status?: string;
      category?: string;
      search?: string;
    };
    const templates = await operationsMessagingService.listLanguageTemplates({
      templateKey: q.templateKey,
      status: q.status,
      category: q.category,
      search: q.search,
    });
    return reply.send({ ok: true, templates });
  });

  app.get(`${api}/language-templates/:templateKey`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const { templateKey } = request.params as { templateKey: string };
    const template = await operationsMessagingService.getLanguageTemplate(
      decodeURIComponent(templateKey)
    );
    return reply.send({ ok: true, template });
  });

  app.post(`${api}/language-templates`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        templateKey: z.string().min(1).max(80),
        displayName: z.string().max(200).optional(),
        category: z
          .enum(['general', 'onboarding', 'advisory', 'orders', 'broadcast', 'notification'])
          .optional(),
        channel: z.enum(['session', 'meta_template']).optional(),
        metaTemplateName: z.string().optional(),
        masterLanguage: z.enum(['en', 'ml', 'ta', 'kn', 'hi']).optional(),
        initialBody: z.string().optional(),
      })
      .parse(request.body);
    const template = await operationsMessagingService.createLanguageTemplateDefinition(body);
    return reply.status(201).send({ ok: true, template });
  });

  app.put(`${api}/language-templates/:templateKey`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { templateKey } = request.params as { templateKey: string };
    const body = z
      .object({
        displayName: z.string().optional(),
        category: z
          .enum(['general', 'onboarding', 'advisory', 'orders', 'broadcast', 'notification'])
          .optional(),
        channel: z.enum(['session', 'meta_template']).optional(),
        metaTemplateName: z.string().nullable().optional(),
        status: z
          .enum(['draft', 'in_translation', 'under_review', 'approved', 'archived'])
          .optional(),
        masterLanguage: z.enum(['en', 'ml', 'ta', 'kn', 'hi']).optional(),
        languages: z
          .record(
            z.enum(['en', 'ml', 'ta', 'kn', 'hi']),
            z.object({
              bodyText: z.string().optional(),
              headerText: z.string().optional(),
              footerText: z.string().optional(),
              status: z.enum(['draft', 'approved', 'archived']).optional(),
            })
          )
          .optional(),
      })
      .parse(request.body);
    const template = await operationsMessagingService.saveLanguageTemplateBundle(
      decodeURIComponent(templateKey),
      body
    );
    return reply.send({ ok: true, template });
  });

  app.post(`${api}/language-templates/:templateKey/duplicate`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { templateKey } = request.params as { templateKey: string };
    const body = z.object({ newKey: z.string().min(1).max(80) }).parse(request.body);
    const template = await operationsMessagingService.duplicateLanguageTemplate(
      decodeURIComponent(templateKey),
      body.newKey
    );
    return reply.status(201).send({ ok: true, template });
  });

  app.post(`${api}/language-templates/:templateKey/preview`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const { templateKey } = request.params as { templateKey: string };
    const body = z
      .object({
        language: z.enum(['en', 'ml', 'ta', 'kn', 'hi']).optional(),
        variables: z.record(z.string()).optional(),
      })
      .parse(request.body ?? {});
    const preview = await operationsMessagingService.previewLanguageTemplate(
      decodeURIComponent(templateKey),
      body.language ?? 'en',
      body.variables
    );
    return reply.send({ ok: true, preview });
  });

  app.post(`${api}/language-templates/:templateKey/translate`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { templateKey } = request.params as { templateKey: string };
    const body = z
      .object({
        targetLanguages: z.array(z.enum(['en', 'ml', 'ta', 'kn', 'hi'])).min(1),
      })
      .parse(request.body);
    const template = await operationsMessagingService.translateLanguageTemplate(
      decodeURIComponent(templateKey),
      body.targetLanguages
    );
    return reply.send({ ok: true, template });
  });

  app.post(`${api}/language-templates/:templateKey/copy-to-all`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { templateKey } = request.params as { templateKey: string };
    const template = await operationsMessagingService.copyLanguageTemplateToAll(
      decodeURIComponent(templateKey)
    );
    return reply.send({ ok: true, template });
  });

  app.post(`${api}/language-templates/legacy`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const body = z
      .object({
        id: z.string().uuid().optional(),
        templateKey: z.string().min(1).max(80),
        language: z.enum(['en', 'ml', 'ta', 'kn', 'hi']),
        channel: z.enum(['session', 'meta_template']).optional(),
        bodyText: z.string().min(1),
        headerText: z.string().optional(),
        footerText: z.string().optional(),
        metaTemplateName: z.string().optional(),
        variableHints: z.array(z.string()).optional(),
        status: z.enum(['draft', 'approved', 'archived']).optional(),
        active: z.boolean().optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);
    const template = await operationsMessagingService.upsertLanguageTemplate(body);
    return reply.send({ ok: true, template });
  });

  app.delete(`${api}/language-templates/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    await operationsMessagingService.deleteLanguageTemplate(id);
    return reply.send({ ok: true });
  });

  app.get(`${api}/automation-jobs`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const q = request.query as { status?: string; jobType?: string; limit?: string; page?: string };
    const result = await operationsMessagingService.listAutomationJobs({
      status: q.status ?? 'active',
      jobType: q.jobType,
      limit: q.limit ? Number(q.limit) : 50,
      page: q.page ? Number(q.page) : 1,
    });
    return reply.send({ ok: true, ...result });
  });

  app.get(`${api}/automation-jobs/stats`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'read');
    const stats = await operationsMessagingService.getAutomationStats();
    return reply.send({ ok: true, stats });
  });

  app.post(`${api}/automation-jobs/:id/cancel`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const job = await operationsMessagingService.cancelAutomationJob(id);
    return reply.send({ ok: true, job });
  });

  app.post(`${api}/automation-jobs/:id/retry`, async (request, reply) => {
    await assertModuleAccess(request, 'operations', 'write');
    const { id } = request.params as { id: string };
    const job = await operationsMessagingService.retryAutomationJob(id);
    return reply.send({ ok: true, job });
  });
}
