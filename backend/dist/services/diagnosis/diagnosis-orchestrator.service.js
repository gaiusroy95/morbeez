import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { moduleFusionService } from '../case/module-fusion.service.js';
import { visitAiContextService } from '../core/visit-ai-context.service.js';
import { visitAiOrchestratorService } from '../core/visit-ai-orchestrator.service.js';
import { resolveVisitImagePredictions } from '../core/visit-ai-image.service.js';
import { buildInsufficientEvidenceEnvelope, isDiagnosisInferenceAvailable, mapImageSourceToDiagnosisSource, } from './diagnosis-integrity.util.js';
function triageRoute(level) {
    if (level === 'L1')
        return 'fast';
    if (level === 'L2')
        return 'standard';
    if (level === 'L3')
        return 'complex';
    return 'critical';
}
function inferSeverityFromConfidence(confidence) {
    if (confidence < 0.55)
        return 'severe';
    if (confidence < 0.75)
        return 'moderate';
    return 'mild';
}
export const diagnosisOrchestratorService = {
    isCapable() {
        return isDiagnosisInferenceAvailable();
    },
    getCapabilityStatus() {
        const openai = Boolean(env.OPENAI_API_KEY?.trim());
        const plantId = Boolean(env.PLANT_ID_API_KEY?.trim());
        return {
            capable: openai || plantId,
            diagnosisDegraded: !openai,
            openai,
            plantId,
        };
    },
    async triagePreview(input) {
        logger.info({
            event: 'diagnosis.triage_preview.start',
            farmerId: input.farmerId,
            blockId: input.blockId,
            photoCount: input.analyzePhotos?.length ?? 0,
        }, 'Diagnosis triage preview started');
        const context = await visitAiContextService.buildVisitAiContext(input);
        const analyzePhotos = input.analyzePhotos?.map((p) => ({
            dataBase64: p.dataBase64,
            mimeType: p.mimeType,
        }));
        const imageSignal = await resolveVisitImagePredictions(analyzePhotos, {
            cropType: context.cropType,
            dap: context.dap,
            stage: context.stage,
        });
        const fusedConfidence = imageSignal?.confidence ?? 0.55;
        const triage = moduleFusionService.triageLevel({
            severity: inferSeverityFromConfidence(fusedConfidence),
            fusedConfidence,
            riskTagCount: context.measurements.length >= 3 ? 2 : 0,
            probableIssue: imageSignal?.label,
        });
        const level = triage.level;
        const result = {
            level,
            reason: triage.reason,
            route: triageRoute(level),
            mandatoryFollowUp: level !== 'L1',
            blockAutoApprove: level === 'L4',
        };
        logger.info({
            event: 'diagnosis.triage_preview.complete',
            farmerId: input.farmerId,
            blockId: input.blockId,
            level: result.level,
            route: result.route,
            fusedConfidence,
        }, 'Diagnosis triage preview complete');
        return result;
    },
    async analyzeVisit(input, agronomistEmail) {
        logger.info({
            event: 'diagnosis.analyze_visit.start',
            farmerId: input.farmerId,
            blockId: input.blockId,
            agronomistEmail,
        }, 'Diagnosis analyze visit started');
        if (!this.isCapable()) {
            return {
                issues: [],
                diagnosisDegraded: true,
                envelope: buildInsufficientEvidenceEnvelope('AI diagnosis unavailable — configure OPENAI_API_KEY or PLANT_ID_API_KEY'),
            };
        }
        const triage = await this.triagePreview(input);
        const result = await visitAiOrchestratorService.analyzeVisit(input, agronomistEmail);
        const issues = (result.issues ?? []).map((issue) => {
            const row = issue;
            const src = row.diagnosisSource ?? 'model';
            const envelope = row.diagnosisEnvelope ?? {
                hypotheses: (row.hypotheses ?? []).map((h) => ({
                    label: h.label,
                    confidence: h.confidence,
                    rationale: h.rationale ?? '',
                    selected: h.selected,
                })),
                source: src,
                degraded: src === 'insufficient_evidence',
                escalationRequired: src === 'insufficient_evidence' || row.confidenceAction === 'escalate',
                evidenceSummary: [],
                triage,
            };
            return { ...issue, diagnosisSource: envelope.source, diagnosisEnvelope: envelope, triage };
        });
        const output = {
            ...result,
            issues,
            triage,
            diagnosisDegraded: !env.OPENAI_API_KEY?.trim(),
        };
        logger.info({
            event: 'diagnosis.analyze_visit.complete',
            farmerId: input.farmerId,
            blockId: input.blockId,
            issueCount: issues.length,
            triageLevel: triage.level,
            diagnosisDegraded: output.diagnosisDegraded,
        }, 'Diagnosis analyze visit complete');
        return output;
    },
    resolveSourceFromImage(hasModel, imageSource) {
        if (hasModel)
            return 'model';
        return mapImageSourceToDiagnosisSource(imageSource);
    },
};
//# sourceMappingURL=diagnosis-orchestrator.service.js.map