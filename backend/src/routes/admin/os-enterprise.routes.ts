import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { verifyInternalApiKey } from '../../middleware/webhookVerify.js';
import { farmerIntelligenceService } from '../../services/intelligence/farmer-intelligence.service.js';
import {
  executiveCockpitService,
  weaknessDashboardService,
  resistanceDashboardService,
} from '../../services/intelligence/enterprise-dashboard.service.js';
import {
  retrainingOpsService,
  protocolDefinitionService,
  applicationHistoryService,
  experimentDefinitionService,
} from '../../services/intelligence/enterprise-ops.service.js';
import { outcomeIntelligenceService } from '../../services/intelligence/outcome-intelligence.service.js';
import { productGapService } from '../../services/core/product-gap.service.js';
import { knowledgeGraphService } from '../../services/knowledge-graph/knowledge-graph.service.js';
import { compatibilityOverrideService } from '../../services/core/compatibility-override.service.js';
import { adaptiveProtocolService } from '../../services/intelligence/adaptive-protocol.service.js';
import { regionalLearningService } from '../../services/regional-learning/regional-learning.service.js';
import { satelliteProviderService } from '../../services/intelligence/satellite-provider.service.js';
import { escalationAdminService } from '../../services/admin/escalation-admin.service.js';
import { agronomistCaseReviewService } from '../../services/admin/agronomist-case-review.service.js';
import { visitReportGeneratorService } from '../../services/core/visit-report-generator.service.js';
import { sensorIngestService } from '../../services/intelligence/sensor-ingest.service.js';
import { satelliteImageryService } from '../../services/intelligence/satellite-imagery.service.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export async function osEnterpriseRoutes(app: FastifyInstance): Promise<void> {
  const api = '/morbeez-staff/api/v1/os';

  app.get(`${api}/intelligence/farmers/:farmerId/360`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const { farmerId } = request.params as { farmerId: string };
    const profile = await farmerIntelligenceService.getFarmer360(farmerId);
    return reply.send({ ok: true, profile });
  });

  app.get(`${api}/analytics/weakness-dashboard`, async (request, reply) => {
    await assertModuleAccess(request, 'analytics', 'read');
    const q = z
      .object({ days: z.coerce.number().optional(), eventType: z.string().optional() })
      .parse(request.query ?? {});
    const data = await weaknessDashboardService.getWeakness(q.days ?? 90, q.eventType);
    return reply.send({ ok: true, ...data });
  });

  app.get(`${api}/analytics/resistance-dashboard`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const rows = await resistanceDashboardService.aggregate();
    return reply.send({ ok: true, rows });
  });

  app.get(`${api}/analytics/executive-cockpit`, async (request, reply) => {
    await assertModuleAccess(request, 'analytics', 'read');
    const q = z.object({ agentEmail: z.string().email().optional() }).parse(request.query ?? {});
    const cockpit = await executiveCockpitService.getCockpit(q.agentEmail);
    return reply.send({ ok: true, cockpit });
  });

  app.get(`${api}/analytics/economic-dashboard`, async (request, reply) => {
    await assertModuleAccess(request, 'analytics', 'read');
    const { data, error } = await supabase
      .from('recommendation_variants')
      .select('variant_key, estimated_cost, protocol_label, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    throwIfSupabaseError(error, 'Could not load economic data');
    return reply.send({ ok: true, variants: data ?? [] });
  });

  app.get(`${api}/escalations/unified`, async (request, reply) => {
    await assertModuleAccess(request, 'telecaller_crm', 'read');
    const [telecaller, aiQueue] = await Promise.all([
      escalationAdminService.list({ status: 'open' }).catch(() => []),
      agronomistCaseReviewService.listQueue({ status: 'open', page: 1, limit: 50 }).catch(() => ({ cases: [] })),
    ]);
    return reply.send({
      ok: true,
      telecallerEscalations: telecaller,
      aiReviewCases: (aiQueue as { cases?: unknown[] }).cases ?? [],
    });
  });

  app.get(`${api}/agronomist/ml-gold-queue`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'read');
    const rows = await retrainingOpsService.listGoldQueue();
    const evalSummary = await retrainingOpsService.getEvalSummary();
    return reply.send({ ok: true, rows, evalSummary });
  });

  app.post(`${api}/agronomist/ml-gold-queue/trigger-export`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'write');
    const result = await retrainingOpsService.triggerWeeklyExport();
    return reply.send({ ok: true, result });
  });

  app.post(`${api}/ml/retrain-webhook`, async (request, reply) => {
    verifyInternalApiKey(request);
    const body = z
      .object({
        status: z.enum(['completed', 'failed', 'running']),
        runId: z.string().optional(),
        metrics: z.record(z.unknown()).optional(),
        queueIds: z.array(z.string().uuid()).optional(),
      })
      .parse(request.body ?? {});

    if (body.queueIds?.length) {
      const nextStatus = body.status === 'completed' ? 'exported' : body.status === 'failed' ? 'failed' : 'pending';
      await supabase
        .from('ml_gold_queue')
        .update({
          status: nextStatus,
          metadata: { retrainWebhook: { runId: body.runId, metrics: body.metrics, at: new Date().toISOString() } },
        })
        .in('id', body.queueIds);
    }

    return reply.send({ ok: true, received: body.status });
  });

  app.get(`${api}/analytics/protocol-funnel`, async (request, reply) => {
    await assertModuleAccess(request, 'analytics', 'read');
    const q = z.object({ days: z.coerce.number().optional() }).parse(request.query ?? {});
    const funnel = await outcomeIntelligenceService.getProtocolFunnelStats(q.days ?? 90);
    return reply.send({ ok: true, funnel });
  });

  app.get(`${api}/product-gaps/:technicalName/inventory-eta`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const { technicalName } = request.params as { technicalName: string };
    const eta = await productGapService.getCommerceInventoryEta(decodeURIComponent(technicalName));
    return reply.send({ ok: true, eta });
  });

  app.get(`${api}/protocols`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const q = z.object({ crop: z.string().optional() }).parse(request.query ?? {});
    const protocols = await protocolDefinitionService.list(q.crop);
    return reply.send({ ok: true, protocols });
  });

  app.post(`${api}/protocols`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'intelligence', 'write');
    const body = z
      .object({
        cropType: z.string(),
        issueLabel: z.string(),
        label: z.string(),
        stages: z.array(z.unknown()),
        products: z.array(z.unknown()).optional(),
      })
      .parse(request.body);
    const row = await protocolDefinitionService.create({
      ...body,
      products: body.products ?? [],
      createdBy: admin.email,
    });
    return reply.status(201).send({ ok: true, protocol: row });
  });

  app.post(`${api}/protocols/:id/publish`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'write');
    const { id } = request.params as { id: string };
    const row = await protocolDefinitionService.publish(id);
    return reply.send({ ok: true, protocol: row });
  });

  app.patch(`${api}/protocols/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        label: z.string().optional(),
        issueLabel: z.string().optional(),
        stages: z.array(z.unknown()).optional(),
        products: z.array(z.unknown()).optional(),
      })
      .parse(request.body);
    const row = await protocolDefinitionService.updateDraft(id, body);
    return reply.send({ ok: true, protocol: row });
  });

  app.get(`${api}/product-gaps/:technicalName/alternatives`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const { technicalName } = request.params as { technicalName: string };
    const q = z.object({ crop: z.string().optional() }).parse(request.query ?? {});
    const alternatives = await productGapService.listAlternatives(
      decodeURIComponent(technicalName),
      q.crop
    );
    return reply.send({ ok: true, alternatives });
  });

  app.get(`${api}/farmers/:farmerId/application-history`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'read');
    const { farmerId } = request.params as { farmerId: string };
    const q = z.object({ blockId: z.string().uuid().optional() }).parse(request.query ?? {});
    const rows = await applicationHistoryService.listForFarmer(farmerId, q.blockId);
    return reply.send({ ok: true, rows });
  });

  app.get(`${api}/knowledge-graph/nodes`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const q = z.object({ crop: z.string().optional(), q: z.string().optional() }).parse(request.query ?? {});
    const nodes = await knowledgeGraphService.listNodes(q.crop, q.q);
    return reply.send({ ok: true, nodes });
  });

  app.post(`${api}/knowledge-graph/nodes`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'write');
    const body = z
      .object({ nodeType: z.string(), label: z.string(), cropType: z.string().optional() })
      .parse(request.body);
    const node = await knowledgeGraphService.upsertNode(body.nodeType, body.label, {
      cropType: body.cropType,
    });
    return reply.status(201).send({ ok: true, node });
  });

  app.patch(`${api}/knowledge-graph/nodes/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        label: z.string().optional(),
        nodeType: z.string().optional(),
        cropType: z.string().optional(),
      })
      .parse(request.body);
    const node = await knowledgeGraphService.updateNode(id, body);
    return reply.send({ ok: true, node });
  });

  app.delete(`${api}/knowledge-graph/nodes/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'write');
    const { id } = request.params as { id: string };
    await knowledgeGraphService.deleteNode(id);
    return reply.send({ ok: true });
  });

  app.get(`${api}/analytics/compatibility-overrides`, async (request, reply) => {
    await assertModuleAccess(request, 'analytics', 'read');
    const q = z.object({ days: z.coerce.number().optional() }).parse(request.query ?? {});
    const aggregates = await compatibilityOverrideService.listAggregates(q.days ?? 90);
    return reply.send({ ok: true, aggregates });
  });

  app.get(`${api}/analytics/adaptive-protocols`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'read');
    const suggestions = await adaptiveProtocolService.listRecentSuggestions();
    return reply.send({ ok: true, suggestions });
  });

  app.post(`${api}/analytics/adaptive-protocols/suggest`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'read');
    const body = z
      .object({
        issueLabel: z.string(),
        cropType: z.string(),
        district: z.string(),
        outcomeStatus: z.literal('worse'),
        agronomistCorrected: z.boolean().optional(),
        applicationLogged: z.boolean().optional(),
        fusedConfidence: z.number().optional(),
      })
      .parse(request.body);
    const suggestion = await adaptiveProtocolService.suggestOnWorseOutcome(body);
    return reply.send({ ok: true, suggestion });
  });

  app.get(`${api}/analytics/rank-templates`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const q = z
      .object({ cropType: z.string(), district: z.string(), issueLabel: z.string() })
      .parse(request.query ?? {});
    const templates = await regionalLearningService.rankTemplates(q.cropType, q.district, q.issueLabel);
    return reply.send({ ok: true, templates });
  });

  app.get(`${api}/field/visits/:findingId/report`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'read');
    const { findingId } = request.params as { findingId: string };
    const report = await visitReportGeneratorService.generate(findingId);
    return reply.send({ ok: true, report });
  });

  app.get(`${api}/experiments`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const q = z.object({ status: z.string().optional() }).parse(request.query ?? {});
    const experiments = await experimentDefinitionService.list(q.status);
    return reply.send({ ok: true, experiments });
  });

  app.get(`${api}/experiments/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const { id } = request.params as { id: string };
    const experiment = await experimentDefinitionService.get(id);
    const variants = await outcomeIntelligenceService.compareVariantsByExperiment(
      String(experiment.experiment_key)
    ).catch(() => []);
    return reply.send({ ok: true, experiment, variantComparison: variants });
  });

  app.post(`${api}/experiments`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'intelligence', 'write');
    const body = z
      .object({
        experimentKey: z.string().min(1).max(80),
        label: z.string().min(1).max(200),
        hypothesis: z.string().max(2000).optional(),
        variants: z.array(z.unknown()).optional(),
      })
      .parse(request.body);
    const row = await experimentDefinitionService.create({ ...body, createdBy: admin.email });
    return reply.status(201).send({ ok: true, experiment: row });
  });

  app.patch(`${api}/experiments/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        label: z.string().min(1).max(200).optional(),
        hypothesis: z.string().max(2000).optional(),
        variants: z.array(z.unknown()).optional(),
        status: z.enum(['draft', 'running', 'completed', 'archived']).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(request.body);
    const row = await experimentDefinitionService.update(id, body);
    return reply.send({ ok: true, experiment: row });
  });

  app.delete(`${api}/experiments/:id`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'write');
    const { id } = request.params as { id: string };
    await experimentDefinitionService.remove(id);
    return reply.send({ ok: true });
  });

  app.post(`${api}/iot/sensor-readings`, async (request, reply) => {
    verifyInternalApiKey(request);
    const body = z
      .object({
        blockId: z.string().uuid(),
        farmerId: z.string().uuid(),
        sensorType: z.string().min(1).max(80),
        value: z.number(),
        unit: z.string().max(20).optional(),
        recordedAt: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(request.body ?? {});
    const row = await sensorIngestService.ingest(body);
    return reply.status(201).send({ ok: true, reading: row });
  });

  app.get(`${api}/plots/:blockId/satellite-overlays`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'read');
    const { blockId } = request.params as { blockId: string };
    const overlays = await satelliteImageryService.listForBlock(blockId);
    return reply.send({ ok: true, overlays });
  });

  app.post(`${api}/plots/:blockId/satellite-refresh`, async (request, reply) => {
    await assertModuleAccess(request, 'intelligence', 'write');
    const { blockId } = request.params as { blockId: string };
    const body = z.object({ farmerId: z.string().uuid() }).parse(request.body ?? {});
    const result = await satelliteProviderService.refreshBlockNdvi(blockId, body.farmerId);
    return reply.send({ ok: true, result });
  });
}
