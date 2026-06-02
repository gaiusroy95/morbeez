import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { agIntelligenceService } from '../../services/admin/ag-intelligence.service.js';
import { farmerOpportunityEngineService } from '../../services/intelligence/farmer-opportunity-engine.service.js';
import { opportunityScoreStoreService } from '../../services/intelligence/opportunity-score-store.service.js';
import { runEmployeePerformanceScoresNow, runFarmerOpportunityScoresNow, } from '../../services/intelligence/farmer-opportunity-score.worker.js';
import { employeePerformanceEngineService } from '../../services/intelligence/employee-performance-engine.service.js';
import { MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD } from '../../services/intelligence/employee-performance-scoring.util.js';
import { opportunityIntelligenceDashboardService } from '../../services/intelligence/opportunity-intelligence-dashboard.service.js';
import { opportunityIntelligenceConfigService } from '../../services/intelligence/opportunity-intelligence-config.service.js';
import { opportunityIntelligenceAlertsService } from '../../services/intelligence/opportunity-intelligence-alerts.service.js';
import { opportunityScoreTrendsService } from '../../services/intelligence/opportunity-score-trends.service.js';
import { opportunityEmployeeLeaderboardsService } from '../../services/intelligence/opportunity-employee-leaderboards.service.js';
import { opportunityNurtureService } from '../../services/intelligence/opportunity-nurture.service.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export async function osIntelligenceRoutes(app) {
    const api = '/morbeez-staff/api/v1/os/intelligence';
    app.get(`${api}/weather-rules`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const rules = await agIntelligenceService.listWeatherRules({
            status: q.status,
            cropType: q.crop,
        });
        return reply.send({ ok: true, rules });
    });
    app.post(`${api}/weather-rules`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'intelligence', 'write');
        const body = z
            .object({
            id: z.string().uuid().optional(),
            ruleKey: z.string().min(1),
            version: z.number().int().optional(),
            cropType: z.string().nullable().optional(),
            conditionJson: z.record(z.unknown()).optional(),
            actionType: z.string().min(1),
            actionPayload: z.record(z.unknown()).optional(),
            priority: z.number().int().optional(),
            status: z.enum(['draft', 'approved', 'archived']).optional(),
            notes: z.string().optional(),
        })
            .parse(request.body);
        const rule = await agIntelligenceService.upsertWeatherRule({
            ...body,
            approvedBy: body.status === 'approved' ? admin.email : undefined,
        });
        return reply.send({ ok: true, rule });
    });
    app.get(`${api}/cultivation-tasks`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const tasks = await agIntelligenceService.listCultivationTasks(q.crop);
        return reply.send({ ok: true, tasks });
    });
    app.post(`${api}/cultivation-tasks`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const body = z
            .object({
            id: z.string().uuid().optional(),
            cropType: z.string().min(1),
            taskKey: z.string().min(1),
            titleEn: z.string().min(1),
            titleMl: z.string().optional(),
            instructionsEn: z.string().optional(),
            instructionsMl: z.string().optional(),
            targetDapMin: z.number().int().nullable().optional(),
            targetDapMax: z.number().int().nullable().optional(),
            growthStage: z.string().optional(),
            priority: z.number().int().optional(),
            active: z.boolean().optional(),
        })
            .parse(request.body);
        const task = await agIntelligenceService.upsertCultivationTask(body);
        return reply.status(body.id ? 200 : 201).send({ ok: true, task });
    });
    app.get(`${api}/recommendation-templates`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const templates = await agIntelligenceService.listRecommendationTemplates({
            status: q.status,
            cropType: q.crop,
        });
        return reply.send({ ok: true, templates });
    });
    app.post(`${api}/recommendation-templates`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'intelligence', 'write');
        const body = z
            .object({
            id: z.string().uuid().optional(),
            cropType: z.string().min(1),
            issueKey: z.string().min(1),
            issueLabelEn: z.string().optional(),
            recommendationTextEn: z.string().min(1),
            recommendationTextMl: z.string().optional(),
            products: z.array(z.unknown()).optional(),
            applicationType: z.string().optional(),
            status: z.enum(['draft', 'approved', 'archived']).optional(),
        })
            .parse(request.body);
        const template = await agIntelligenceService.upsertRecommendationTemplate({
            ...body,
            approvedBy: body.status === 'approved' ? admin.email : undefined,
        });
        return reply.send({ ok: true, template });
    });
    app.get(`${api}/spray-compatibility`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const rules = await agIntelligenceService.listSprayCompatibility();
        return reply.send({ ok: true, rules });
    });
    app.post(`${api}/spray-compatibility`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const body = z
            .object({
            id: z.string().uuid().optional(),
            productA: z.string().min(1),
            productB: z.string().min(1),
            compatible: z.boolean(),
            minIntervalHours: z.number().int().nullable().optional(),
            notes: z.string().optional(),
            active: z.boolean().optional(),
        })
            .parse(request.body);
        const rule = await agIntelligenceService.upsertSprayCompatibility(body);
        return reply.send({ ok: true, rule });
    });
    app.get(`${api}/resistance-rotation`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const rows = await agIntelligenceService.listResistanceRotation(q.crop);
        return reply.send({ ok: true, rows });
    });
    app.post(`${api}/resistance-rotation`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const body = z
            .object({
            id: z.string().uuid().optional(),
            cropType: z.string().min(1),
            modeOfAction: z.string().min(1),
            rotationOrder: z.number().int().min(1),
            technicalName: z.string().min(1),
            notes: z.string().optional(),
            active: z.boolean().optional(),
        })
            .parse(request.body);
        const row = await agIntelligenceService.upsertResistanceRotation(body);
        return reply.send({ ok: true, row });
    });
    app.delete(`${api}/:table/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const { table, id } = request.params;
        const allowed = new Set([
            'cultivation-tasks',
            'recommendation-templates',
            'spray-compatibility',
            'resistance-rotation',
            'weather-rules',
        ]);
        if (!allowed.has(table)) {
            return reply.status(400).send({ ok: false, message: 'Invalid resource' });
        }
        const tableMap = {
            'cultivation-tasks': 'cultivation_task_master',
            'recommendation-templates': 'recommendation_templates',
            'spray-compatibility': 'spray_compatibility_rules',
            'resistance-rotation': 'resistance_rotation_groups',
            'weather-rules': 'weather_rule_definitions',
        };
        await agIntelligenceService.deleteRow(tableMap[table], id);
        return reply.send({ ok: true });
    });
    app.get(`${api}/opportunity-scores/top`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const limit = Math.min(q.limit ? Number(q.limit) : 25, 100);
        let query = supabase
            .from('farmer_scores')
            .select('farmer_id, opportunity_score, engagement_score, trust_score, calculated_at, farmers(name, phone, district)')
            .order('opportunity_score', { ascending: false })
            .limit(limit);
        if (q.minScore) {
            query = query.gte('opportunity_score', Number(q.minScore));
        }
        const { data, error } = await query;
        throwIfSupabaseError(error, 'Could not load opportunity scores');
        return reply.send({ ok: true, farmers: data ?? [] });
    });
    app.post(`${api}/opportunity-scores/recalculate`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const body = z
            .object({
            farmerId: z.string().uuid().optional(),
            employeeProfileId: z.string().uuid().optional(),
            limit: z.number().int().min(1).max(2000).optional(),
            dryRun: z.boolean().optional(),
            includeEmployees: z.boolean().optional(),
            runBusinessActions: z.boolean().optional(),
        })
            .parse(request.body ?? {});
        if (body.farmerId && !body.dryRun) {
            const score = await farmerOpportunityEngineService.scoreFarmer(body.farmerId);
            return reply.send({ ok: true, score, batch: null, employeeBatch: null });
        }
        if (body.employeeProfileId && !body.dryRun) {
            const { data: profile } = await supabase
                .from('employee_profiles')
                .select('email, admin_user_id')
                .eq('id', body.employeeProfileId)
                .maybeSingle();
            let email = profile?.email ? String(profile.email).trim().toLowerCase() : '';
            if (!email && profile?.admin_user_id) {
                const { data: admin } = await supabase
                    .from('admin_users')
                    .select('email')
                    .eq('id', profile.admin_user_id)
                    .maybeSingle();
                email = admin?.email ? String(admin.email).trim().toLowerCase() : '';
            }
            if (!email) {
                return reply.code(400).send({ ok: false, message: 'Employee email not found' });
            }
            const score = await employeePerformanceEngineService.scoreEmployee(body.employeeProfileId, email);
            return reply.send({ ok: true, score, batch: null, employeeBatch: null });
        }
        const batch = await runFarmerOpportunityScoresNow({
            farmerId: body.farmerId,
            limit: body.limit,
            dryRun: body.dryRun,
        });
        const employeeBatch = body.includeEmployees !== false && !body.dryRun
            ? await runEmployeePerformanceScoresNow({ limit: body.limit ?? 200, dryRun: body.dryRun })
            : null;
        let businessActions = null;
        if (body.runBusinessActions && !body.dryRun) {
            const alerts = await opportunityIntelligenceAlertsService.generateDailyAlerts();
            const retention = await opportunityIntelligenceAlertsService.enqueueRetentionTasks(50);
            const nurture = await opportunityNurtureService.enqueueLowOpportunityNurture({ limit: 25 });
            businessActions = { alerts, retention, nurture };
        }
        return reply.send({ ok: true, batch, employeeBatch, businessActions, score: null });
    });
    app.get(`${api}/performance-scores/employees/top`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const limit = Math.min(q.limit ? Number(q.limit) : 25, 100);
        const { data, error } = await supabase
            .from('employee_scores')
            .select('employee_profile_id, performance_score, attributed_farmer_count, calculated_at, employee_profiles(full_name, email, role)')
            .gte('attributed_farmer_count', MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD)
            .order('performance_score', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Could not load employee leaderboard');
        return reply.send({
            ok: true,
            minAttributedFarmers: MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD,
            employees: data ?? [],
        });
    });
    app.get(`${api}/performance-scores/employees/:employeeProfileId`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const { employeeProfileId } = request.params;
        const score = await opportunityScoreStoreService.getEmployeeScore(employeeProfileId);
        return reply.send({ ok: true, score });
    });
    app.get(`${api}/opportunity-scores/farmers/:farmerId`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const { farmerId } = request.params;
        const score = await opportunityScoreStoreService.getFarmerScore(farmerId);
        const { data: retention } = await supabase
            .from('farmer_retention_tracking')
            .select('risk_band, retention_score, days_since_last_inbound, calculated_at')
            .eq('farmer_id', farmerId)
            .maybeSingle();
        return reply.send({
            ok: true,
            score,
            retention: retention ?? null,
        });
    });
    const dash = `${api}/opportunity-dashboard`;
    app.get(`${dash}/overview`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const overview = await opportunityIntelligenceDashboardService.getOverview(q.days ? Number(q.days) : 30);
        const eventVolume = await opportunityIntelligenceDashboardService.getEventVolumeByType(q.days ? Number(q.days) : 30);
        return reply.send({ ok: true, overview, eventVolume });
    });
    app.get(`${dash}/districts`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const districts = await opportunityIntelligenceDashboardService.getDistrictHeatmap(q.limit ? Number(q.limit) : 40);
        return reply.send({ ok: true, districts });
    });
    app.get(`${dash}/farmers/top`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const farmers = await opportunityIntelligenceDashboardService.listTopFarmers({
            limit: q.limit ? Number(q.limit) : 25,
            minScore: q.minScore ? Number(q.minScore) : undefined,
            district: q.district,
        });
        return reply.send({ ok: true, farmers });
    });
    app.get(`${dash}/farmers/at-risk`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const farmers = await opportunityIntelligenceDashboardService.listAtRiskFarmers(q.limit ? Number(q.limit) : 50);
        return reply.send({ ok: true, farmers });
    });
    app.get(`${dash}/farmers/:farmerId`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const { farmerId } = request.params;
        const profile = await opportunityIntelligenceDashboardService.getFarmerProfile(farmerId);
        return reply.send({ ok: true, profile });
    });
    app.get(`${dash}/employees`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const employees = await opportunityIntelligenceDashboardService.listEmployeeLeaderboard(q.limit ? Number(q.limit) : 25);
        return reply.send({
            ok: true,
            minAttributedFarmers: MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD,
            employees,
        });
    });
    app.get(`${api}/performance-scores/employees/top-relationship-builders`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const employees = await opportunityEmployeeLeaderboardsService.listTopRelationshipBuilders(q.limit ? Number(q.limit) : 25);
        return reply.send({
            ok: true,
            minAttributedFarmers: MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD,
            employees,
        });
    });
    app.get(`${api}/performance-scores/employees/high-retention`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const employees = await opportunityEmployeeLeaderboardsService.listHighRetentionEmployees(q.limit ? Number(q.limit) : 25);
        return reply.send({
            ok: true,
            minAttributedFarmers: MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD,
            employees,
        });
    });
    app.get(`${api}/opportunity-scores/farmers/:farmerId/metric-history`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const { farmerId } = request.params;
        const q = request.query;
        const limit = Math.min(q.limit ? Number(q.limit) : 24, 100);
        const { data, error } = await supabase
            .from('farmer_metric_history')
            .select('metric_dimension, score, max_weight, evidence, period_start, period_end, calculated_at')
            .eq('farmer_id', farmerId)
            .order('calculated_at', { ascending: false })
            .limit(limit);
        throwIfSupabaseError(error, 'Could not load metric history');
        return reply.send({ ok: true, history: data ?? [] });
    });
    app.get(`${api}/opportunity-scores/farmers/:farmerId/trend`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const { farmerId } = request.params;
        const q = request.query;
        const trend = await opportunityScoreTrendsService.getFarmerTrend(farmerId, q.limit ? Number(q.limit) : 12);
        return reply.send({ ok: true, trend });
    });
    app.get(`${api}/performance-scores/employees/:employeeProfileId/trend`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const { employeeProfileId } = request.params;
        const q = request.query;
        const trend = await opportunityScoreTrendsService.getEmployeeTrend(employeeProfileId, q.limit ? Number(q.limit) : 12);
        return reply.send({ ok: true, trend });
    });
    const oppConfig = `${api}/opportunity-config`;
    app.get(oppConfig, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const config = await opportunityIntelligenceConfigService.get();
        return reply.send({ ok: true, config });
    });
    app.patch(oppConfig, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const body = z
            .object({
            farmerWeightOverrides: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
            employeeWeightOverrides: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
            alertThresholds: z
                .object({
                highOpportunityMin: z.number().int().min(0).max(100).optional(),
                autoCreateCrmTasks: z.boolean().optional(),
                employeeAtRiskCohortPct: z.number().min(0).max(1).optional(),
            })
                .optional(),
        })
            .parse(request.body ?? {});
        const admin = request.admin;
        const config = await opportunityIntelligenceConfigService.update({
            farmerWeightOverrides: body.farmerWeightOverrides,
            employeeWeightOverrides: body.employeeWeightOverrides,
            alertThresholds: body.alertThresholds,
            updatedByAdminId: admin?.id,
        });
        return reply.send({ ok: true, config });
    });
    const alertsApi = `${api}/opportunity-alerts`;
    app.get(alertsApi, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'read');
        const q = request.query;
        const alerts = await opportunityIntelligenceAlertsService.list({
            status: q.status,
            alertType: q.type,
            limit: q.limit ? Number(q.limit) : 50,
        });
        return reply.send({ ok: true, alerts });
    });
    app.post(`${alertsApi}/generate`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const result = await opportunityIntelligenceAlertsService.generateDailyAlerts();
        return reply.send({ ok: true, ...result });
    });
    app.post(`${alertsApi}/enqueue-tasks`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const body = z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(request.body ?? {});
        const result = await opportunityIntelligenceAlertsService.enqueueRetentionTasks(body.limit ?? 40);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${alertsApi}/enqueue-nurture`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const body = z
            .object({
            limit: z.number().int().min(1).max(100).optional(),
            maxScore: z.number().int().min(0).max(100).optional(),
        })
            .parse(request.body ?? {});
        const result = await opportunityNurtureService.enqueueLowOpportunityNurture({
            limit: body.limit ?? 25,
            maxScore: body.maxScore,
        });
        return reply.send({ ok: true, ...result });
    });
    app.post(`${alertsApi}/:alertId/acknowledge`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const { alertId } = request.params;
        const admin = request.admin;
        if (!admin?.id)
            return reply.status(401).send({ ok: false, error: 'Unauthorized' });
        await opportunityIntelligenceAlertsService.acknowledge(alertId, admin.id);
        return reply.send({ ok: true });
    });
    app.post(`${alertsApi}/:alertId/dismiss`, async (request, reply) => {
        await assertModuleAccess(request, 'intelligence', 'write');
        const { alertId } = request.params;
        const admin = request.admin;
        if (!admin?.id)
            return reply.status(401).send({ ok: false, error: 'Unauthorized' });
        await opportunityIntelligenceAlertsService.dismiss(alertId, admin.id);
        return reply.send({ ok: true });
    });
}
//# sourceMappingURL=os-intelligence.routes.js.map