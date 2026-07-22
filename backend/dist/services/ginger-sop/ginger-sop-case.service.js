import { supabase } from '../../lib/supabase.js';
import { blockService } from '../core/block.service.js';
import { GINGER_SOP_VERSION } from '../../domain/ginger-sop/types.js';
import { gingerSopEvidenceService } from './ginger-sop-evidence.service.js';
import { gingerSopRiskTagsService } from './ginger-sop-risk-tags.service.js';
import { gingerSopConfidenceService } from './ginger-sop-confidence.service.js';
import { gingerSopGatesService } from './ginger-sop-gates.service.js';
import { gingerSopFieldDataService } from './ginger-sop-field-data.service.js';
import { gingerSopCanopyAuditService } from './ginger-sop-canopy-audit.service.js';
function isGingerCrop(cropType) {
    return cropType.toLowerCase().includes('ginger');
}
function buildHypotheses(input) {
    const rows = [];
    const primary = input.advisory?.probableIssue?.trim();
    if (primary) {
        rows.push({
            label: primary,
            probability: Math.round((input.advisory?.confidence ?? 0.65) * 100),
            source: 'ai',
        });
    }
    for (const alt of input.advisory?.differentialDiagnosis ?? []) {
        if (!alt.label?.trim())
            continue;
        rows.push({
            label: alt.label,
            probability: Math.round((alt.probability ?? 0.25) * 100),
            source: 'ai',
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
export const gingerSopCaseService = {
    isGingerCrop,
    async resolveIdentity(farmerId, blockId) {
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
        return {
            farmerId,
            blockId: block?.id ?? null,
            cropType: block?.crop_type ?? 'ginger',
            variety: block?.variety ?? null,
            acreage: block?.acreage_decimal != null ? Number(block.acreage_decimal) : null,
            plantingDate: block?.planting_date ?? null,
            dap: block?.dap ?? null,
            complete: missing.length === 0,
            missingFields: missing,
        };
    },
    async buildCase(input) {
        if (!isGingerCrop(input.cropType))
            return null;
        const identity = await this.resolveIdentity(input.farmerId, input.blockId);
        const photos = gingerSopEvidenceService.assignPhotosToSlots({
            photoCount: input.photoCount ?? 0,
            channel: input.channel,
            storagePaths: input.photoStoragePaths,
        });
        const hasRootPhoto = photos.some((p) => p.status === 'captured' &&
            ['root_photo', 'rhizome_outside', 'rhizome_cut'].includes(p.slot));
        const completenessPct = gingerSopEvidenceService.completenessPct(photos);
        const fieldCtx = await gingerSopFieldDataService.loadFieldContext({
            farmerId: input.farmerId,
            blockId: identity.blockId ?? input.blockId,
            dap: identity.dap ?? input.contextPack?.dap ?? null,
            metadata: {
                irrigationPh: input.waterReading?.irrigationPh ?? undefined,
                irrigationEc: input.waterReading?.irrigationEc ?? undefined,
            },
        });
        const fieldMetrics = input.fieldMetrics ?? fieldCtx.fieldMetrics;
        const canopyAudit = input.canopyAudit ?? fieldCtx.canopyAudit;
        const waterReading = input.waterReading ?? fieldCtx.waterReading;
        const inputHistory = input.inputHistory ?? fieldCtx.inputHistory;
        const hasFieldMetrics = Boolean(fieldMetrics?.spad != null || fieldMetrics?.plantHeightCm != null);
        const hasCanopyAudit = Boolean(canopyAudit?.auditComplete);
        const hasWaterData = Boolean(waterReading?.irrigationPh != null || waterReading?.irrigationEc != null);
        const hasInputHistory = Boolean(inputHistory?.hasRecentActivity);
        const evidenceTier = gingerSopEvidenceService.evidenceTier(completenessPct, Boolean(input.hasSoilReport), hasRootPhoto, hasFieldMetrics);
        const riskTags = gingerSopRiskTagsService.compute({
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
        });
        const weatherStress = gingerSopRiskTagsService.weatherStress({
            weatherRiskScore: input.contextPack?.weatherRiskScore,
            heavyRainLikely: input.contextPack?.heavyRainLikely,
            highHeatLikely: input.contextPack?.highHeatLikely,
            highHumidityLikely: input.contextPack?.highHumidityLikely,
            drainageRisk: input.contextPack?.drainageRisk,
        });
        const modelConfidence = input.advisory?.confidence ?? 0.55;
        const moduleScores = gingerSopConfidenceService.buildModuleScores({
            evidenceCompleteness: completenessPct,
            hasBlockId: Boolean(identity.blockId),
            hasSoilReport: Boolean(input.hasSoilReport),
            hasWaterData,
            hasInputHistory,
            hasRootPhoto,
            hasFieldMetrics,
            hasCanopyAudit,
            canopyModuleScore: canopyAudit
                ? gingerSopCanopyAuditService.scoreForModule(canopyAudit)
                : undefined,
            intakeMatchConfidence: input.intakeMatchConfidence,
            modelConfidence,
        });
        const fusedConfidence = gingerSopConfidenceService.fusedConfidence(moduleScores, modelConfidence, null);
        const triage = gingerSopConfidenceService.triageLevel({
            severity: input.advisory?.severity,
            fusedConfidence,
            riskTagCount: riskTags.length,
            probableIssue: input.advisory?.probableIssue,
        });
        const nutrientNeeded = needsNutrientAdvice(input.advisory?.probableIssue, riskTags);
        const { route, gates } = gingerSopGatesService.evaluate({
            identityComplete: identity.complete,
            evidenceCompleteness: completenessPct,
            evidenceTier,
            triageLevel: triage.level,
            fusedConfidence,
            hasSoilForNutrientRec: Boolean(input.hasSoilReport),
            needsNutrientAdvice: nutrientNeeded,
            channel: input.channel,
        });
        const hypotheses = buildHypotheses(input);
        return {
            sopVersion: GINGER_SOP_VERSION,
            channel: input.channel,
            sessionId: input.sessionId,
            identity,
            triage,
            riskTags,
            evidence: {
                photos,
                completenessPct,
                tier: evidenceTier,
            },
            weatherStress,
            diagnostics: {
                hypotheses,
                primary: hypotheses[0]?.label,
                secondary: hypotheses[1]?.label,
                moduleScores,
                modelConfidence,
                fusedConfidence,
            },
            gates,
            route,
            recoveryDaysEstimate: triage.level === 'L1' ? 7 : triage.level === 'L2' ? 10 : 14,
            createdAt: new Date().toISOString(),
            fieldMetrics,
            canopyAudit,
            waterReading,
            inputHistory,
        };
    },
    async persistToSession(sessionId, gingerCase) {
        const { data: row } = await supabase
            .from('ai_advisory_sessions')
            .select('metadata')
            .eq('id', sessionId)
            .maybeSingle();
        const metadata = row?.metadata ?? {};
        await supabase
            .from('ai_advisory_sessions')
            .update({
            metadata: {
                ...metadata,
                gingerSopV3: gingerCase,
            },
            confidence_score: gingerCase.diagnostics.fusedConfidence,
            escalation_recommended: gingerCase.route === 'field_visit' ||
                gingerCase.route === 'emergency_callback' ||
                gingerCase.route === 'agronomist_review',
            updated_at: new Date().toISOString(),
        })
            .eq('id', sessionId);
    },
    formatTelecallerNotes(gingerCase) {
        const h = gingerCase.diagnostics.hypotheses
            .slice(0, 3)
            .map((x) => `${x.label} (${x.probability}%)`)
            .join('; ');
        return [
            `Ginger SOP v3 — ${gingerCase.triage.level}`,
            `Route: ${gingerCase.route}`,
            `Evidence: ${gingerCase.evidence.completenessPct}% (${gingerCase.evidence.tier})`,
            `Fused conf: ${Math.round(gingerCase.diagnostics.fusedConfidence * 100)}%`,
            `Risks: ${gingerCase.riskTags.join(', ') || 'none'}`,
            `Top causes: ${h || 'pending'}`,
        ].join('\n');
    },
};
//# sourceMappingURL=ginger-sop-case.service.js.map