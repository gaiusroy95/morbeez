import { env } from '../../config/env.js';
import { maiosKnowledgeService } from './knowledge.service.js';
import { maiosContextEvidenceService } from './context-evidence.service.js';
import { maiosEvidenceRepositoryService } from './evidence-repository.service.js';
import { maiosBayesianEngineService } from './bayesian-engine.service.js';
import { maiosEvsiEngineService } from './evsi-engine.service.js';
import { maiosDecisionEngineService } from './decision-engine.service.js';
import { maiosExplainabilityEngineService } from './explainability-engine.service.js';
import { maiosScientificManagementService } from './scientific-management.service.js';
import { maiosSafetyEngineService } from './safety-engine.service.js';
import { maiosFinalReportService } from './final-report.service.js';
/** Composes MAIOS v12 case data through v17 reasoning domains without replacing LLM/MAIOS fusion. */
export const maiosReasoningPipelineService = {
    isEnabled() {
        return env.ENABLE_MAIOS_REASONING !== false;
    },
    async run(input) {
        if (!this.isEnabled())
            return null;
        const pkg = maiosKnowledgeService.load(input.cropType, input.pack);
        const contextItems = maiosContextEvidenceService.build({
            cropType: input.cropType,
            symptomsText: input.symptomsText,
            contextPack: input.contextPack,
            regionalPriors: input.regionalPriors,
        });
        const evidence = maiosEvidenceRepositoryService.merge({
            contextItems,
            visionLabel: input.visionLabel ?? input.hypotheses[0]?.label,
            visionConfidence: input.visionConfidence ?? input.hypotheses[0]?.probability / 100,
            visionFeatures: input.visionObservations,
            farmerAnswers: input.farmerAnswers,
            photos: input.photos,
            pack: input.pack,
            cropType: input.cropType,
        });
        const prior = maiosBayesianEngineService.buildPrior(pkg, input.regionalPriors);
        const posterior = maiosBayesianEngineService.update(pkg, prior, evidence);
        const answered = new Set(input.answeredQuestionIds ?? []);
        for (const ans of input.farmerAnswers ?? []) {
            if (ans.questionId)
                answered.add(ans.questionId);
        }
        const nextQuestion = maiosEvsiEngineService.rankQuestions({
            pkg,
            posterior,
            evidence,
            answeredQuestionIds: answered,
        });
        const missingSlots = maiosEvidenceRepositoryService.missingPhotoSlots({
            contextItems,
            photos: input.photos,
            pack: input.pack,
        });
        const nextPhoto = !nextQuestion || nextQuestion.expectedInformationGain < 8
            ? maiosEvsiEngineService.rankMissingPhoto({ missingSlots, posterior })
            : null;
        const nextEvidence = nextQuestion && (!nextPhoto || nextQuestion.expectedInformationGain >= nextPhoto.expectedInformationGain)
            ? nextQuestion
            : nextPhoto;
        const decision = maiosDecisionEngineService.evaluate({
            posterior,
            evidence,
            eqs: input.eqs,
            escalationRecommended: input.escalationRecommended,
            maiosRoute: input.maiosRoute,
        });
        const explanation = maiosExplainabilityEngineService.build({
            pkg,
            posterior,
            evidence,
            llmHypothesisLabels: input.hypotheses.map((h) => h.label),
            missingPhotoSlots: missingSlots,
        });
        const locked = decision.action === 'LOCK';
        const management = maiosScientificManagementService.build({
            pkg,
            diagnosisLabel: decision.topLabel ?? explanation.diagnosis,
            locked,
        });
        const safety = maiosSafetyEngineService.validate({
            pkg,
            management,
            dap: input.dap,
            contextPack: input.contextPack,
            harvestWithinDays: input.harvestWithinDays,
        });
        const finalReport = maiosFinalReportService.build({
            decision,
            explanation,
            evidence,
            management,
            safety,
            nextStepLabel: nextEvidence?.label ?? null,
        });
        return {
            pipelineVersion: '17.0',
            knowledgeVersion: pkg.version,
            evidence,
            prior,
            posterior,
            decision,
            explanation,
            nextEvidence,
            management,
            safety,
            finalReport,
            shadowMode: env.MAIOS_REASONING_SHADOW !== false,
        };
    },
    /** Blend Bayesian posterior into existing MAIOS hypotheses (enrichment, not replacement). */
    enrichHypotheses(hypotheses, snapshot) {
        if (snapshot.shadowMode)
            return hypotheses;
        const byLabel = new Map(snapshot.posterior.map((p) => [p.label.toLowerCase(), p.probability]));
        const merged = hypotheses.map((h) => {
            const bayesian = byLabel.get(h.label.toLowerCase());
            if (bayesian == null)
                return h;
            const blended = Math.round(h.probability * 0.4 + bayesian * 100 * 0.6);
            return {
                ...h,
                probability: Math.max(h.probability, Math.min(98, blended)),
                source: (h.source === 'fusion' ? 'fusion' : 'M5'),
            };
        });
        for (const p of snapshot.posterior) {
            if (p.label === 'Unknown')
                continue;
            if (merged.some((h) => h.label.toLowerCase() === p.label.toLowerCase()))
                continue;
            if (p.probability < 0.08)
                continue;
            merged.push({
                label: p.label,
                probability: Math.round(p.probability * 100),
                source: 'M5',
            });
        }
        return merged.sort((a, b) => b.probability - a.probability).slice(0, 5);
    },
};
//# sourceMappingURL=maios-reasoning-pipeline.service.js.map