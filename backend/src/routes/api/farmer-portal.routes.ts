import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireFarmer } from '../../middleware/require-farmer.js';
import { farmerPortalService } from '../../services/farmer/farmer-portal.service.js';
import { farmerPortalMobileService } from '../../services/farmer/farmer-portal-mobile.service.js';
import { farmerProductReviewService } from '../../services/farmer/farmer-product-review.service.js';
import { assertBase64ImageSize } from '../../lib/upload-limits.js';

const uuidParam = z.string().uuid();
const uploadBodyLimit = { bodyLimit: env.UPLOAD_BODY_LIMIT_BYTES };

function parseUuid(value: string): string {
  return uuidParam.parse(value);
}

const imageDataSchema = z
  .string()
  .min(32)
  .max(11_000_000)
  .superRefine((val, ctx) => {
    try {
      assertBase64ImageSize(val);
    } catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: e instanceof Error ? e.message : 'Image too large' });
    }
  });

/**
 * Farmer customer portal — JWT-protected, no CRM internals exposed.
 */
export async function farmerPortalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/store/product-reviews', async (request, reply) => {
    const q = request.query as { productId?: string };
    if (!q.productId?.trim()) {
      return reply.status(400).send({ ok: false, message: 'productId is required' });
    }
    const result = await farmerProductReviewService.aggregateForProduct(q.productId.trim());
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/summary', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const summary = await farmerPortalService.getSummary(farmerId);
    return reply.send({ ok: true, ...summary });
  });

  app.get('/api/v1/farmer/portal/orders', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.listOrders(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/orders/:id/tracking', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    const result = await farmerPortalService.getOrderTracking(farmerId, id);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/orders/:id/reviews', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    const body = z
      .object({
        productKey: z.string().min(1).max(160),
        rating: z.number().int().min(1).max(5),
        reviewText: z.string().max(2000).optional(),
      })
      .parse(request.body);
    const review = await farmerPortalService.submitOrderReview(farmerId, id, body);
    return reply.status(201).send({ ok: true, review });
  });

  app.get('/api/v1/farmer/portal/advisory', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.getAdvisory(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/soil-reports', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.listSoilReports(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/soil-reports', { config: uploadBodyLimit }, async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        blockId: z.string().uuid(),
        reportedAt: z.string().min(8).optional(),
        macro: z.record(z.string()).optional(),
        micro: z.record(z.string()).optional(),
        remarks: z.string().max(500).optional(),
        imageData: imageDataSchema.optional(),
        mimeType: z.string().optional(),
      })
      .parse(request.body);
    const report = await farmerPortalService.createSoilReport(farmerId, body);
    return reply.status(201).send({ ok: true, report });
  });

  app.get('/api/v1/farmer/portal/roi', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.getRoi(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/notifications', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const notifications = await farmerPortalService.listNotifications(farmerId);
    return reply.send({ ok: true, notifications });
  });

  app.get('/api/v1/farmer/portal/field-photos', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.listFieldPhotos(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/field-photos', { config: uploadBodyLimit }, async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        photoType: z.enum(['field', 'leaf', 'rhizome']),
        imageData: imageDataSchema,
        mimeType: z.string().optional(),
        notes: z.string().max(300).optional(),
      })
      .parse(request.body);
    const result = await farmerPortalService.uploadFieldPhoto(farmerId, body);
    return reply.status(201).send(result);
  });

  app.patch('/api/v1/farmer/portal/address', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        address1: z.string().max(240).optional(),
        address2: z.string().max(120).optional(),
        city: z.string().max(80).optional(),
        state: z.string().max(80).optional(),
        pincode: z.string().max(10).optional(),
      })
      .parse(request.body);
    const profile = await farmerPortalService.updateShippingAddress(farmerId, body);
    return reply.send({ ok: true, profile });
  });

  app.get('/api/v1/farmer/portal/profile', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const profile = await farmerPortalService.getProfile(farmerId);
    return reply.send({ ok: true, profile });
  });

  app.patch('/api/v1/farmer/portal/language', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        preferredLanguage: z.enum(['en', 'hi', 'ml', 'ta', 'kn']),
      })
      .parse(request.body);
    const profile = await farmerPortalService.updatePreferredLanguage(farmerId, body.preferredLanguage);
    return reply.send({ ok: true, profile });
  });

  app.get('/api/v1/farmer/portal/blocks', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalMobileService.listBlocks(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/blocks', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        name: z.string().min(1).max(120),
        cropType: z.string().min(1).max(80),
        acreage: z.number().positive().optional(),
        plantingDate: z.string().optional(),
        irrigationType: z.string().max(80).optional(),
      })
      .parse(request.body);
    const block = await farmerPortalMobileService.createBlock(farmerId, body);
    return reply.status(201).send({ ok: true, block });
  });

  app.patch('/api/v1/farmer/portal/blocks/:id', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    parseUuid(id);
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        cropType: z.string().min(1).max(80).optional(),
        acreage: z.number().positive().optional(),
        plantingDate: z.string().optional(),
        irrigationType: z.string().max(80).optional(),
      })
      .parse(request.body);
    const block = await farmerPortalMobileService.updateBlock(farmerId, id, body);
    return reply.send({ ok: true, block });
  });

  app.get('/api/v1/farmer/portal/blocks/:id', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    parseUuid(id);
    const result = await farmerPortalMobileService.getBlockDetail(farmerId, id);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/blocks/:id/timeline', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    parseUuid(id);
    const timeline = await farmerPortalMobileService.getBlockTimeline(farmerId, id);
    return reply.send({ ok: true, timeline });
  });

  app.post('/api/v1/farmer/portal/scan', { config: uploadBodyLimit }, async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        blockId: z.string().uuid().optional(),
        scanType: z.enum(['leaf', 'field', 'rhizome']),
        imageData: imageDataSchema,
        mimeType: z.string().optional(),
        language: z.enum(['en', 'ml', 'ta', 'kn', 'hi']).optional(),
      })
      .parse(request.body);
    const result = await farmerPortalMobileService.runScan(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/scans', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { blockId?: string; limit?: string };
    if (q.blockId) parseUuid(q.blockId);
    const scans = await farmerPortalMobileService.listScans(farmerId, {
      blockId: q.blockId,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    return reply.send({ ok: true, scans });
  });

  app.get('/api/v1/farmer/portal/scan/:sessionId', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { sessionId } = request.params as { sessionId: string };
    parseUuid(sessionId);
    const result = await farmerPortalMobileService.getScan(sessionId, farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/recommendations', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalMobileService.listRecommendations(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/recommendations/:id', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    const recommendation = await farmerPortalMobileService.getRecommendation(farmerId, id);
    return reply.send({ ok: true, recommendation });
  });

  app.post('/api/v1/farmer/portal/recommendations/:id/applied', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    const result = await farmerPortalMobileService.markRecommendationApplied(farmerId, id);
    return reply.send(result);
  });

  app.get('/api/v1/farmer/portal/activities', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { blockId?: string; type?: string; from?: string; to?: string };
    const result = await farmerPortalMobileService.listActivities(farmerId, q);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/activities', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        blockId: z.string().uuid(),
        activityType: z.enum(['spray_applied', 'fertigation', 'drench', 'scouting', 'irrigation', 'other']),
        activityDate: z.string().min(8),
        productUsed: z.string().max(200).optional(),
        quantity: z.string().max(80).optional(),
        notes: z.string().max(500).optional(),
        costInr: z.number().min(0).optional(),
        activityTypeId: z.string().uuid().optional(),
      })
      .parse(request.body);
    const result = await farmerPortalMobileService.createActivity(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/roi/entries', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        entryType: z.enum(['labour', 'purchase', 'misc', 'harvest', 'income']),
        amount: z.number().positive(),
        entryDate: z.string().min(8),
        comments: z.string().max(500).optional(),
      })
      .parse(request.body);
    const result = await farmerPortalMobileService.createRoiEntry(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/weather', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { blockId?: string };
    const weather = await farmerPortalMobileService.getWeather(farmerId, q.blockId);
    return reply.send({ ok: true, weather });
  });

  app.get('/api/v1/farmer/portal/market-prices', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string };
    const market = await farmerPortalMobileService.getMarketPrices(farmerId, q.crop);
    return reply.send({ ok: true, market });
  });

  app.get('/api/v1/farmer/portal/market/crops', async (_request, reply) => {
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    const crops = await farmerMarketPortalService.listCrops();
    return reply.send({ ok: true, crops });
  });

  app.get('/api/v1/farmer/portal/market/markets', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string };
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    const markets = await farmerMarketPortalService.listMarkets(farmerId, q.crop ?? 'ginger');
    return reply.send({ ok: true, markets });
  });

  app.get('/api/v1/farmer/portal/market/dashboard', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string; market?: string };
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    const dashboard = await farmerMarketPortalService.getDashboard(farmerId, q.crop, q.market);
    return reply.send({ ok: true, dashboard });
  });

  app.get('/api/v1/farmer/portal/market/trends', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string; range?: string; market?: string };
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    const trends = await farmerMarketPortalService.getTrends(farmerId, q.crop, q.range, q.market);
    return reply.send({ ok: true, trends });
  });

  app.get('/api/v1/farmer/portal/market/mandi-comparison', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string; market?: string };
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    const comparison = await farmerMarketPortalService.getMandiComparison(farmerId, q.crop, q.market);
    return reply.send({ ok: true, comparison });
  });

  app.get('/api/v1/farmer/portal/market/crop-comparison', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { market?: string };
    const { farmerMarketPortalService } = await import('../../services/farmer/farmer-market-portal.service.js');
    const comparison = await farmerMarketPortalService.getMultiCropComparison(farmerId, q.market);
    return reply.send({ ok: true, comparison });
  });

  /** @deprecated Use GET /roi/summary — kept for legacy mobile builds */
  app.get('/api/v1/farmer/portal/roi/dashboard', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { roiAggregationService } = await import('../../services/farmer/roi-aggregation.service.js');
    const summary = await roiAggregationService.getSummary(farmerId, {});
    const dashboard = {
      investmentInr: summary.financial?.expenseInr ?? 0,
      projectedRevenueInr: summary.financial?.incomeInr ?? 0,
      profitInr: summary.financial?.profitInr ?? 0,
      roiPercent: summary.financial?.roiPercent ?? 0,
      breakdown: summary.breakdown ?? [],
      seasonLabel: summary.cropStatus?.crop ?? undefined,
      dap: summary.cropStatus?.dap,
      stageLabel: summary.cropStatus?.stageLabel,
    };
    return reply.send({ ok: true, dashboard });
  });

  app.get('/api/v1/farmer/portal/roi/season/active', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { blockId?: string };
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const dashboard = await cropSeasonService.getActiveDashboard(farmerId, q.blockId);
    return reply.send({ ok: true, dashboard });
  });

  app.get('/api/v1/farmer/portal/roi/summary', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string; blockId?: string };
    const { roiAggregationService } = await import('../../services/farmer/roi-aggregation.service.js');
    const summary = await roiAggregationService.getSummary(farmerId, {
      crop: q.crop ?? null,
      blockId: q.blockId ?? null,
    });
    return reply.send({ ok: true, summary });
  });

  app.get('/api/v1/farmer/portal/roi/context', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string; blockId?: string };
    const { roiAggregationService } = await import('../../services/farmer/roi-aggregation.service.js');
    const context = await roiAggregationService.getContext(farmerId, {
      crop: q.crop ?? null,
      blockId: q.blockId ?? null,
    });
    return reply.send({ ok: true, context });
  });

  app.get('/api/v1/farmer/portal/roi/expense-types', async (request, reply) => {
    requireFarmer(request);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const types = await cropSeasonService.listExpenseTypes(true);
    return reply.send({ ok: true, types });
  });

  app.get('/api/v1/farmer/portal/roi/labour-types', async (request, reply) => {
    requireFarmer(request);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const types = await cropSeasonService.listLabourTypes(true);
    return reply.send({ ok: true, types });
  });

  app.get('/api/v1/farmer/portal/roi/activity-types', async (request, reply) => {
    requireFarmer(request);
    const q = request.query as { crop?: string };
    const { whatsappOsAdminService } = await import('../../services/admin/whatsapp-os-admin.service.js');
    const types = await whatsappOsAdminService.listFieldActivityTypes({
      cropType: q.crop,
      activeOnly: true,
    });
    return reply.send({ ok: true, types });
  });

  app.post('/api/v1/farmer/portal/roi/activity-types', async (request, reply) => {
    requireFarmer(request);
    const body = z
      .object({
        activityName: z.string().min(1).max(80),
        crop: z.string().max(40).optional(),
        category: z.string().max(40).optional(),
        icon: z.string().max(16).optional(),
      })
      .parse(request.body);
    const { whatsappOsAdminService } = await import('../../services/admin/whatsapp-os-admin.service.js');
    const row = await whatsappOsAdminService.createFieldActivityType({
      activityName: body.activityName,
      crop: body.crop ?? null,
      category: body.category,
      icon: body.icon,
    });
    return reply.status(201).send({
      ok: true,
      type: {
        id: String(row.id),
        activityName: String(row.activity_name),
        icon: row.icon ? String(row.icon) : null,
        category: row.category ? String(row.category) : undefined,
      },
    });
  });

  app.get('/api/v1/farmer/portal/roi/categories', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const categories = await cropSeasonService.listCategories(farmerId);
    return reply.send({ ok: true, categories });
  });

  app.post('/api/v1/farmer/portal/roi/categories', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        name: z.string().min(1).max(80),
        icon: z.string().max(8).optional(),
        color: z.string().max(20).optional(),
        ledgerEntryType: z.enum(['labour', 'purchase', 'misc', 'harvest', 'income']).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const category = await cropSeasonService.createFarmerCategory(farmerId, body);
    return reply.status(201).send({ ok: true, category });
  });

  app.post('/api/v1/farmer/portal/roi/expenses', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        seasonId: z.string().uuid().optional(),
        blockId: z.string().uuid().optional(),
        expenseTypeId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        amount: z.number().positive(),
        entryDate: z.string().min(8).optional(),
        note: z.string().max(500).optional(),
      })
      .refine((b) => Boolean(b.expenseTypeId || b.categoryId), {
        message: 'expenseTypeId or categoryId is required',
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.createQuickExpense(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/roi/labour', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        seasonId: z.string().uuid().optional(),
        labourTypeId: z.string().uuid(),
        workers: z.number().int().min(0).max(500).optional(),
        amount: z.number().positive(),
        note: z.string().max(500).optional(),
        entryDate: z.string().min(8).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.createLabourExpense(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/roi/harvest', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        seasonId: z.string().uuid().optional(),
        blockId: z.string().uuid().optional(),
        harvestDate: z.string().min(8).optional(),
        yieldKg: z.number().positive(),
        sellingPricePerKg: z.number().positive(),
        buyer: z.string().max(120).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.recordHarvestSale(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/roi/harvest-sale', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        seasonId: z.string().uuid().optional(),
        blockId: z.string().uuid().optional(),
        harvestDate: z.string().min(8).optional(),
        yieldKg: z.number().positive(),
        sellingPricePerKg: z.number().positive(),
        buyer: z.string().max(120).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.recordHarvestSale(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/roi/income', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        seasonId: z.string().uuid().optional(),
        blockId: z.string().uuid().optional(),
        incomeSubtype: z.enum(['advance', 'subsidy', 'other']),
        amount: z.number().positive(),
        entryDate: z.string().min(8).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.recordIncome(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/roi/season/:seasonId/finish', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { seasonId } = request.params as { seasonId: string };
    parseUuid(seasonId);
    const body = z
      .object({
        password: z.string().min(1).max(128).optional(),
        confirmText: z.string().min(1).max(32),
      })
      .parse(request.body ?? {});
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.finishSeason(farmerId, seasonId, body);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/roi/season/start', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        blockId: z.string().uuid(),
        crop: z.string().min(1).max(80),
        acreage: z.number().positive().optional(),
        plantingDate: z.string().min(8).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const season = await cropSeasonService.startSeason(farmerId, body);
    return reply.status(201).send({ ok: true, season });
  });

  app.get('/api/v1/farmer/portal/roi/transactions', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as {
      seasonId?: string;
      blockId?: string;
      crop?: string;
      type?: string;
      from?: string;
      to?: string;
      categoryId?: string;
      page?: string;
      limit?: string;
    };
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.listTransactions(farmerId, {
      seasonId: q.seasonId,
      blockId: q.blockId,
      crop: q.crop,
      type: q.type === 'expense' || q.type === 'income' ? q.type : undefined,
      from: q.from,
      to: q.to,
      categoryId: q.categoryId,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 50,
    });
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/roi/expense-book', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string; blockId?: string };
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const book = await cropSeasonService.getExpenseBook(farmerId, q);
    return reply.send({ ok: true, ...book });
  });

  app.get('/api/v1/farmer/portal/roi/analytics', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { crop?: string; blockId?: string };
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const analytics = await cropSeasonService.getAnalytics(farmerId, q);
    return reply.send({ ok: true, analytics });
  });

  app.patch('/api/v1/farmer/portal/roi/transactions/:entryId', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { entryId } = request.params as { entryId: string };
    parseUuid(entryId);
    const body = z
      .object({
        amount: z.number().positive().optional(),
        note: z.string().max(500).optional(),
        entryDate: z.string().min(8).optional(),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.updateTransaction(farmerId, entryId, body);
    return reply.send({ ok: true, ...result });
  });

  app.delete('/api/v1/farmer/portal/roi/transactions/:entryId', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { entryId } = request.params as { entryId: string };
    parseUuid(entryId);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.deleteTransaction(farmerId, entryId);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/roi/purchase-order', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        orderId: z.string().min(1).max(120),
        amount: z.number().positive(),
        productSummary: z.string().min(1).max(500),
      })
      .parse(request.body);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.createPurchaseFromOrder(farmerId, body);
    return reply.status(201).send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/roi/history', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const q = request.query as { v?: string };
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    if (q.v === '2') {
      const history = await cropSeasonService.listHistoryV2(farmerId);
      return reply.send({ ok: true, ...history });
    }
    const seasons = await cropSeasonService.listHistory(farmerId);
    return reply.send({ ok: true, seasons });
  });

  app.get('/api/v1/farmer/portal/roi/history/:seasonId', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { seasonId } = request.params as { seasonId: string };
    parseUuid(seasonId);
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const detail = await cropSeasonService.getHistoryDetail(farmerId, seasonId);
    return reply.send({ ok: true, detail });
  });

  app.get('/api/v1/farmer/portal/roi/season/:seasonId/entries', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { seasonId } = request.params as { seasonId: string };
    parseUuid(seasonId);
    const q = request.query as { page?: string; limit?: string };
    const { cropSeasonService } = await import('../../services/farmer/crop-season.service.js');
    const result = await cropSeasonService.listSeasonEntries(
      farmerId,
      seasonId,
      q.page ? Number(q.page) : 1,
      q.limit ? Number(q.limit) : 30
    );
    return reply.send({ ok: true, ...result });
  });
}
