import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { blockService } from '../core/block.service.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import { evidenceQualityService } from './evidence-quality.service.js';
import { riskTagsService } from './risk-tags.service.js';
import { moduleFusionService } from './module-fusion.service.js';
import { caseGatesService } from './case-gates.service.js';
import { fieldContextService } from './field-context.service.js';
import { canopyAuditService } from './canopy-audit.service.js';
import { cropStageService } from './crop-stage.service.js';
import { multiModelFusionService } from './multi-model-fusion.service.js';
import { labIntelligenceService } from '../lab-intelligence/lab-intelligence.service.js';
import { resistanceDetectionService } from './resistance-detection.service.js';
import { predictiveRiskService } from '../predictive-risk/predictive-risk.service.js';
import { regionalLearningService } from '../regional-learning/regional-learning.service.js';
import { maiosLearningFacadeService } from '../maios-reasoning/maios-learning-facade.service.js';
import { groundIntelligenceService } from '../ground-intelligence/ground-intelligence.service.js';
import { knowledgeGraphService } from '../knowledge-graph/knowledge-graph.service.js';
import { supplyIntelligenceService } from '../supply-intelligence/supply-intelligence.service.js';
import { cultivationContextService } from './cultivation-context.service.js';
import { inputHistoryService } from './input-history.service.js';
import { maiosReasoningPipelineService } from '../maios-reasoning/maios-reasoning-pipeline.service.js';
import { MAIOS_VERSION as MAIOS_VER } from '../../domain/case/types.js';
function buildHypotheses(input) {
    const rows = [];
    const primary = input.advisory?.probableIssue?.trim();
    if (primary) {
        rows.push({
            label: primary,
            probability: Math.round((input.advisory?.confidence ?? 0.65) * 100),
            source: 'M1',
        });
    }
    for (const alt of input.advisory?.differentialDiagnosis ?? []) {
        if (!alt.label?.trim())
            continue;
        rows.push({
            label: alt.label,
            probability: Math.round((alt.probability ?? 0.25) * 100),
            source: 'M1',
        });
    }
    return rows
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5)
        .map((h, i) => ({ ...h, probability: h.probability || Math.max(10, 80 - i * 12) }));
}
function needsNutrientAdvice(issue, tags) {
    const blob = (issue ?? '').toLowerCase();
    if (/nutrient|deficien|chlorosis|yellow|k\b|n\b|zn|iron/.test(blob))
        return true;
    return Boolean(tags?.includes('NUTRIENT_DEFICIENCY_RISK'));
}
async function loadTemporalComparison(params) {
    let q = supabase
        .from('ai_advisory_sessions')
        .select('id, metadata, created_at')
        .eq('farmer_id', params.farmerId)
        .not('metadata->maiosCase', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);
    const { data: rows } = await q;
    for (const row of rows ?? []) {
        if (params.excludeSessionId && row.id === params.excludeSessionId)
            continue;
        const meta = row.metadata ?? {};
        const prior = meta.maiosCase;
        if (!prior)
            continue;
        if (params.blockId && prior.identity?.blockId && prior.identity.blockId !== params.blockId) {
            continue;
        }
        const priorIssue = prior.diagnostics?.primary ?? prior.diagnostics?.hypotheses?.[0]?.label;
        if (!priorIssue)
            continue;
        if (params.currentIssue && priorIssue.toLowerCase() === params.currentIssue.toLowerCase()) {
            return `Same primary issue as prior case (${priorIssue}) on ${String(row.created_at).slice(0, 10)}`;
        }
        return `Shift from prior ${priorIssue} (${String(row.created_at).slice(0, 10)}) to current ${params.currentIssue ?? 'issue'}`;
    }
    return undefined;
}
export const caseBuilderService = {
    async resolveIdentity(farmerId, blockId, cropType) {
        const block = blockId
            ? await blockService.getById(blockId, farmerId).catch(() => null)
            : await blockService.getPrimaryBlock(farmerId).catch(() => null);
        const missing = [];
        if (!block?.id)
            missing.push('plot');
        if (!block?.crop_type)
            missing.push('crop');
        if (block?.planting_date == null && block?.dap == null)
            missing.push('planting_date_or_dap');
        const resolvedCrop = block?.crop_type ?? cropType ?? '_default';
        const pack = await cropPackLoaderService.load(resolvedCrop);
        const dap = block?.dap ?? null;
        const stage = cropStageService.stageForDap(pack, dap);
        return {
            farmerId,
            blockId: block?.id ?? null,
            cropType: resolvedCrop,
            cropPackId: `${pack.cropType}:${pack.version}`,
            variety: block?.variety ?? null,
            acreage: block?.acreage_decimal != null ? Number(block.acreage_decimal) : null,
            plantingDate: block?.planting_date ?? null,
            dap,
            stage: stage?.label ?? null,
            complete: missing.length === 0,
            missingFields: missing,
        };
    },
    async buildCase(input) {
        const pack = await cropPackLoaderService.load(input.cropType);
        const identity = await this.resolveIdentity(input.farmerId, input.blockId, input.cropType);
        const photos = evidenceQualityService.assignPhotosToSlots({
            pack,
            photoCount: input.photoCount ?? 0,
            channel: input.channel,
            storagePaths: input.photoStoragePaths,
            captions: input.photoCaptions,
        });
        const hasRootPhoto = photos.some((p) => p.status === 'captured' && pack.rootPhotoSlots.includes(p.slot));
        const completenessPct = evidenceQualityService.completenessPct(photos, pack.photoSlots.length);
        const fieldCtx = await fieldContextService.loadFieldContext({
            farmerId: input.farmerId,
            blockId: identity.blockId ?? input.blockId,
            dap: identity.dap ?? input.contextPack?.dap ?? null,
            pack,
            metadata: {
                irrigationPh: input.waterReading?.irrigationPh ?? undefined,
                irrigationEc: input.waterReading?.irrigationEc ?? undefined,
            },
        });
        const cultivationCtx = await cultivationContextService.loadForBlock({
            cropType: identity.cropType,
            dap: identity.dap,
        });
        const labReports = input.labReports ??
            (await labIntelligenceService.loadForFarmer(input.farmerId, identity.blockId));
        const fieldMetrics = input.fieldMetrics ?? fieldCtx.fieldMetrics;
        const canopyAudit = input.canopyAudit ?? fieldCtx.canopyAudit;
        const waterReading = input.waterReading ?? fieldCtx.waterReading;
        const inputHistory = input.inputHistory ?? fieldCtx.inputHistory;
        const hasFieldMetrics = Boolean(fieldMetrics?.spad != null || fieldMetrics?.plantHeightCm != null);
        const hasCanopyAudit = Boolean(canopyAudit?.auditComplete);
        const hasWaterData = Boolean(waterReading?.irrigationPh != null || waterReading?.irrigationEc != null);
        const hasInputHistory = Boolean(inputHistory?.hasRecentActivity);
        const hasLabReport = Boolean(labReports?.length);
        const evidenceTier = evidenceQualityService.evidenceTier(completenessPct, Boolean(input.hasSoilReport) || hasLabReport, hasRootPhoto, hasFieldMetrics);
        const eqs = evidenceQualityService.computeEqs({
            completenessPct,
            tier: evidenceTier,
            hasSoil: Boolean(input.hasSoilReport) || hasLabReport,
            hasRootPhoto,
            hasFieldMetrics,
            hasWaterData,
            hasLabReport,
        });
        const resistance = await resistanceDetectionService.score({
            farmerId: input.farmerId,
            blockId: identity.blockId,
            cropType: identity.cropType,
            inputHistory,
        });
        const riskTags = riskTagsService.compute({
            pack,
            soilPh: input.contextPack?.soilPh,
            soilEc: input.contextPack?.soilEc,
            irrigationPh: waterReading?.irrigationPh ?? undefined,
            irrigationEc: waterReading?.irrigationEc ?? undefined,
            weatherRiskScore: input.contextPack?.weatherRiskScore,
            heavyRainLikely: input.contextPack?.heavyRainLikely,
            highHeatLikely: input.contextPack?.highHeatLikely,
            highHumidityLikely: input.contextPack?.highHumidityLikely,
            drainageRisk: input.contextPack?.drainageRisk,
            symptomsText: input.symptomsText,
            probableIssue: input.advisory?.probableIssue,
            resistanceScore: resistance.score,
        });
        if (cultivationCtx.hasOverdue) {
            riskTags.push('ROOT_STRESS_RISK');
        }
        const weatherStress = riskTagsService.weatherStress({
            weatherRiskScore: input.contextPack?.weatherRiskScore,
            heavyRainLikely: input.contextPack?.heavyRainLikely,
            highHeatLikely: input.contextPack?.highHeatLikely,
            highHumidityLikely: input.contextPack?.highHumidityLikely,
            drainageRisk: input.contextPack?.drainageRisk,
        });
        const modelConfidence = input.advisory?.confidence ?? 0.55;
        const canopyScore = canopyAudit
            ? canopyAuditService.scoreForModule(canopyAudit)
            : undefined;
        const regionalCluster = await regionalLearningService.resolveCluster({
            farmerId: input.farmerId,
            cropType: identity.cropType,
            soilPh: input.contextPack?.soilPh,
        });
        const regionalPriors = regionalCluster
            ? await regionalLearningService.topIssuePriors(identity.cropType, regionalCluster.clusterKey.split(':')[1] ?? '')
            : [];
        const moduleScores = moduleFusionService.buildModuleScores({
            pack,
            evidenceCompleteness: completenessPct,
            hasBlockId: Boolean(identity.blockId),
            hasSoilReport: Boolean(input.hasSoilReport) || hasLabReport,
            hasWaterData,
            hasInputHistory,
            hasRootPhoto,
            hasFieldMetrics,
            hasCanopyAudit,
            hasLabReport,
            hasRegionalData: Boolean(regionalCluster),
            canopyModuleScore: canopyScore,
            intakeMatchConfidence: input.intakeMatchConfidence,
            modelConfidence,
        });
        const fusedConfidence = moduleFusionService.fusedConfidence(moduleScores, modelConfidence, null);
        const triage = moduleFusionService.triageLevel({
            severity: input.advisory?.severity,
            fusedConfidence,
            riskTagCount: riskTags.length,
            probableIssue: input.advisory?.probableIssue,
            rootStressPattern: pack.riskRules?.rootStressPattern,
        });
        const nutrientNeeded = needsNutrientAdvice(input.advisory?.probableIssue, riskTags);
        const { route, gates } = caseGatesService.evaluate({
            identityComplete: identity.complete,
            evidenceCompleteness: completenessPct,
            eqs,
            evidenceTier,
            triageLevel: triage.level,
            fusedConfidence,
            hasSoilForNutrientRec: Boolean(input.hasSoilReport) || hasLabReport,
            needsNutrientAdvice: nutrientNeeded,
            channel: input.channel,
        });
        let hypotheses = buildHypotheses(input);
        const kgCandidates = await knowledgeGraphService.queryCandidates({
            cropType: identity.cropType,
            symptoms: [
                input.symptomsText ?? '',
                input.advisory?.probableIssue ?? '',
                ...(input.advisory?.differentialDiagnosis?.map((d) => d.label) ?? []),
            ].filter(Boolean),
        });
        const mm = await multiModelFusionService.enrichHypotheses(hypotheses, {
            modelConfidence,
            hasPlantId: Boolean(input.plantIdConfidence),
            moduleScores,
            regionalPriors,
            kgCandidates,
            labReports,
        });
        hypotheses = mm.hypotheses;
        const predictiveRisk = env.ENABLE_MAIOS_PREDICTIVE_RISK !== false
            ? await predictiveRiskService.scoreBlock({
                farmerId: input.farmerId,
                blockId: identity.blockId,
                cropType: identity.cropType,
                contextPack: input.contextPack,
                riskTagCount: riskTags.length,
                regionalClusterKey: regionalCluster?.clusterKey,
            })
            : undefined;
        const groundRemote = identity.blockId
            ? await groundIntelligenceService.loadForBlock(identity.blockId).catch(() => undefined)
            : undefined;
        const supplySignals = await supplyIntelligenceService.suggestFromTags({
            cropType: identity.cropType,
            productTags: input.advisory?.recommendedProductTags ?? [],
            farmerId: input.farmerId,
        });
        const temporalComparison = await loadTemporalComparison({
            farmerId: input.farmerId,
            blockId: identity.blockId,
            currentIssue: input.advisory?.probableIssue,
            excludeSessionId: input.sessionId,
        });
        if (input.advisory?.probableIssue && regionalCluster) {
            const district = regionalCluster.clusterKey.split(':')[1];
            if (district) {
                void regionalLearningService.recordIssueStat(district, identity.cropType, input.advisory.probableIssue);
            }
        }
        let reasoning = await maiosReasoningPipelineService.run({
            cropType: identity.cropType,
            pack,
            symptomsText: input.symptomsText,
            contextPack: {
                ...input.contextPack,
                dap: identity.dap ?? input.contextPack?.dap ?? null,
                daysSinceLastFertilizer: inputHistoryService.daysSinceLastFertilizer(inputHistory),
                cropType: identity.cropType,
            },
            regionalPriors,
            photos,
            hypotheses,
            eqs,
            maiosRoute: route,
            escalationRecommended: input.advisory?.escalationRecommended,
            visionLabel: undefined,
            visionConfidence: undefined,
            farmerAnswers: input.farmerAnswers,
            visionObservations: input.visionObservations,
            dap: identity.dap ?? input.contextPack?.dap ?? null,
        });
        if (reasoning && !reasoning.shadowMode) {
            hypotheses = maiosReasoningPipelineService.enrichHypotheses(hypotheses, reasoning);
        }
        if (reasoning?.decision.action === 'LOCK') {
            void maiosLearningFacadeService.recordFromReasoningSnapshot({
                farmerId: input.farmerId,
                cropType: identity.cropType,
                sessionId: input.sessionId,
                channel: input.channel === 'field_visit' ? 'visit' : input.channel === 'api' ? 'api' : 'whatsapp',
                snapshot: reasoning,
            });
        }
        return {
            maiosVersion: MAIOS_VER,
            sopVersion: pack.version,
            channel: input.channel,
            sessionId: input.sessionId,
            identity,
            triage,
            riskTags,
            evidence: { photos, completenessPct, eqs, tier: evidenceTier },
            weatherStress,
            diagnostics: {
                hypotheses,
                primary: hypotheses[0]?.label,
                secondary: hypotheses[1]?.label,
                moduleScores,
                modelConfidence,
                fusedConfidence,
                modelAgreement: mm.modelAgreement,
                causalChain: input.advisory?.causalChain,
                explanation: input.advisory?.explanation,
                rejectedHypotheses: input.advisory?.rejectedHypotheses,
                temporalComparison,
            },
            gates,
            route,
            recoveryDaysEstimate: triage.level === 'L1' ? 7 : triage.level === 'L2' ? 10 : 14,
            createdAt: new Date().toISOString(),
            fieldMetrics,
            canopyAudit,
            waterReading,
            inputHistory,
            labReports,
            groundRemote,
            resistanceScore: resistance.score,
            resistanceClasses: resistance.classes,
            predictiveRisk,
            supplySignals,
            regionalClusterId: regionalCluster?.clusterKey ?? null,
            reasoning: reasoning ?? undefined,
        };
    },
    formatTelecallerNotes(maiosCase) {
        const h = maiosCase.diagnostics.hypotheses
            .slice(0, 3)
            .map((x) => `${x.label} (${x.probability}%)`)
            .join('; ');
        return [
            `MAIOS v${maiosCase.maiosVersion} — ${maiosCase.identity.cropType} ${maiosCase.triage.level}`,
            `Route: ${maiosCase.route}`,
            `Evidence: ${maiosCase.evidence.completenessPct}% EQS ${maiosCase.evidence.eqs} (${maiosCase.evidence.tier})`,
            `Fused conf: ${Math.round(maiosCase.diagnostics.fusedConfidence * 100)}%`,
            `Risks: ${maiosCase.riskTags.join(', ') || 'none'}`,
            `Top causes: ${h || 'pending'}`,
        ].join('\n');
    },
};
//# sourceMappingURL=case-builder.service.js.map