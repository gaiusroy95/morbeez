import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { moduleFusionService } from '../case/module-fusion.service.js';
import { visitAiOrchestratorService } from '../core/visit-ai-orchestrator.service.js';
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
        // Fast path: route from field assessment + measurements only (no vision API — that runs on AI analysis).
        const measurementCount = input.measurements?.length ?? 0;
        const assessment = input.blockAssessment;
        let fusedConfidence = 0.72;
        let severity = 'mild';
        if (assessment?.blockHealth === 'need_assistance') {
            severity = 'moderate';
            fusedConfidence = 0.58;
        }
        if (assessment?.cropPerformance === 'below_expectation') {
            severity = severity === 'mild' ? 'moderate' : severity;
            fusedConfidence = Math.min(fusedConfidence, 0.65);
        }
        if (assessment?.soilMoisture === 'waterlogged') {
            severity = 'moderate';
            fusedConfidence = Math.min(fusedConfidence, 0.6);
        }
        else if (assessment?.soilMoisture === 'dry') {
            fusedConfidence = Math.min(fusedConfidence, 0.68);
        }
        const riskTagCount = measurementCount >= 3 ? 2 : assessment?.blockHealth === 'need_assistance' ? 1 : 0;
        const triage = moduleFusionService.triageLevel({
            severity,
            fusedConfidence,
            riskTagCount,
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