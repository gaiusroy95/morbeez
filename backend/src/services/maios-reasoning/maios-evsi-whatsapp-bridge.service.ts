import type { MaiosHypothesis } from '../../domain/case/types.js';
import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { EvsiPlannerHint } from './evsi-planner-hint.types.js';
import type { AdvisoryLanguage, StructuredAdvisory } from '../ai/types.js';
import type { InvestigationContext } from '../whatsapp/pipeline/diagnosis-follow-up-reasoning.engine.js';
import type {
  GeneratedFollowUpQuestion,
  PostDiagnosisAdvisorySnapshot,
} from '../whatsapp/pipeline/diagnosis-follow-up-question.generator.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import { buildWhatsAppVisionObservations } from './crop-doctor-reasoning-bridge.service.js';
import { maiosReasoningAdapterService } from './maios-reasoning-adapter.service.js';
import { maiosReasoningPipelineService } from './maios-reasoning-pipeline.service.js';

function farmerAnswersFromIntake(
  priorAnswers: Record<string, string>,
  questionTexts: Record<string, string>
): Array<{ questionId?: string; questionText: string; answer: string }> {
  return Object.entries(priorAnswers).map(([id, answer]) => ({
    questionId: id.startsWith('photo:') ? undefined : id,
    questionText: questionTexts[id] ?? id,
    answer,
  }));
}

function answeredIdsFromIntake(priorAnswers: Record<string, string>): string[] {
  return Object.keys(priorAnswers).filter((id) => !id.startsWith('photo:'));
}

function hypothesesFromAdvisory(advisory: PostDiagnosisAdvisorySnapshot): MaiosHypothesis[] {
  const rows = (advisory.differentialDiagnosis ?? []).slice(0, 5).map((d, i) => ({
    label: d.label,
    probability: Math.round((d.probability ?? Math.max(0.12, 0.55 - i * 0.1)) * 100),
    source: 'M1' as const,
  }));
  if (rows.length) return rows;
  return [
    {
      label: advisory.probableIssue,
      probability: Math.round(advisory.confidence * 100),
      source: 'M1' as const,
    },
  ];
}

function hypothesesFromInvestigation(_investigation: InvestigationContext): MaiosHypothesis[] {
  return [{ label: 'Unknown', probability: 40, source: 'M5' as const }];
}

function minimalAdvisoryFromSnapshot(advisory: PostDiagnosisAdvisorySnapshot): StructuredAdvisory {
  return {
    probableIssue: advisory.probableIssue,
    confidence: advisory.confidence,
    uncertain: advisory.uncertain ?? false,
    nutrientDeficiency: [],
    stressAnalysis: advisory.stressAnalysis ?? [],
    treatments: [],
    dosageGuidance: [],
    precautions: [],
    escalationRecommended: false,
    farmerSummaryEn: '',
    farmerSummaryMl: '',
    recommendedProductTags: [],
    imageObservations: advisory.imageObservations,
    differentialDiagnosis: advisory.differentialDiagnosis,
    rejectedHypotheses: advisory.rejectedHypotheses,
  };
}

/** Map v17 EVSI nextEvidence into WhatsApp structured follow-up questions (additive, shadow-safe). */
export const maiosEvsiWhatsappBridgeService = {
  isEnabled(): boolean {
    return maiosReasoningPipelineService.isEnabled();
  },

  /** Metadata only — farmer-facing wording comes from the LLM planner. */
  plannerHintFromReasoning(
    reasoning: MaiosReasoningSnapshot | null | undefined,
    priorAnswers: Record<string, string>
  ): EvsiPlannerHint | null {
    if (!reasoning?.nextEvidence || reasoning.decision.action === 'LOCK') return null;
    const next = reasoning.nextEvidence;

    if (next.kind === 'photo_slot') {
      const id = `photo:${next.id}`;
      if (priorAnswers[id] !== undefined) return null;
      return {
        questionId: id,
        kind: 'photo',
        evidenceSlot: next.id,
        informationGain: next.expectedInformationGain,
      };
    }

    if (next.kind === 'question') {
      if (priorAnswers[next.id] !== undefined) return null;
      return {
        questionId: next.id,
        kind: 'yes_no',
        evidenceSlot: next.id,
        informationGain: next.expectedInformationGain,
      };
    }

    return null;
  },

  buildFollowUpFromReasoning(_params: {
    reasoning: MaiosReasoningSnapshot | null | undefined;
    priorAnswers: Record<string, string>;
    questionsAsked: number;
    maxQuestions: number;
  }): GeneratedFollowUpQuestion | null {
    return null;
  },

  async refreshReasoningForPostDiagnosis(params: {
    investigation: InvestigationContext;
    advisory: PostDiagnosisAdvisorySnapshot;
    priorAnswers: Record<string, string>;
    questionTexts: Record<string, string>;
    storedReasoning?: MaiosReasoningSnapshot | null;
    photoCount?: number;
  }): Promise<MaiosReasoningSnapshot | null> {
    if (!this.isEnabled()) return params.storedReasoning ?? null;

    const pack = await cropPackLoaderService.load(params.investigation.cropType);
    const photos =
      (params.photoCount ?? 0) > 0
        ? pack.photoSlots.slice(0, params.photoCount).map((slot, i) => ({
            slot: slot.id,
            status: 'captured' as const,
            qualityScore: i === 0 ? 80 : 72,
          }))
        : [];

    const visionObservations = buildWhatsAppVisionObservations({
      advisory: minimalAdvisoryFromSnapshot(params.advisory),
    });

    const farmerAnswers = farmerAnswersFromIntake(params.priorAnswers, params.questionTexts);

    return maiosReasoningAdapterService.fromWhatsApp({
      cropType: params.investigation.cropType,
      symptomsText: params.investigation.symptomsText,
      contextPack: {
        weatherRiskScore: params.investigation.weatherRiskScore,
        heavyRainLikely: params.investigation.heavyRainLikely,
        highHeatLikely: params.investigation.highHeatLikely,
        highHumidityLikely: params.investigation.highHumidityLikely,
      },
      hypotheses: hypothesesFromAdvisory(params.advisory),
      photos,
      eqs: params.investigation.hasPhoto ? 58 : 42,
      visionLabel: undefined,
      visionConfidence: undefined,
      visionObservations,
      farmerAnswers,
      answeredQuestionIds: answeredIdsFromIntake(params.priorAnswers),
      dap: params.investigation.dap,
    });
  },

  async refreshReasoningForPreDiagnosis(params: {
    investigation: InvestigationContext;
    priorAnswers: Record<string, string>;
    questionTexts: Record<string, string>;
  }): Promise<MaiosReasoningSnapshot | null> {
    if (!this.isEnabled()) return null;

    const pack = await cropPackLoaderService.load(params.investigation.cropType);
    const visionObservations = (params.investigation.imageObservations ?? []).length
      ? buildWhatsAppVisionObservations({
          advisory: {
            probableIssue: 'Field issue',
            confidence: 0.5,
            uncertain: true,
            nutrientDeficiency: [],
            stressAnalysis: [],
            treatments: [],
            dosageGuidance: [],
            precautions: [],
            escalationRecommended: false,
            farmerSummaryEn: '',
            farmerSummaryMl: '',
            recommendedProductTags: [],
            imageObservations: params.investigation.imageObservations,
          } satisfies StructuredAdvisory,
        })
      : [];

    const farmerAnswers = farmerAnswersFromIntake(params.priorAnswers, params.questionTexts);

    return maiosReasoningAdapterService.fromWhatsApp({
      cropType: params.investigation.cropType,
      symptomsText: params.investigation.symptomsText,
      contextPack: {
        weatherRiskScore: params.investigation.weatherRiskScore,
        heavyRainLikely: params.investigation.heavyRainLikely,
        highHeatLikely: params.investigation.highHeatLikely,
        highHumidityLikely: params.investigation.highHumidityLikely,
      },
      hypotheses: hypothesesFromInvestigation(params.investigation),
      photos: params.investigation.hasPhoto
        ? pack.photoSlots.slice(0, 1).map((slot) => ({
            slot: slot.id,
            status: 'captured' as const,
            qualityScore: 78,
          }))
        : [],
      eqs: params.investigation.hasPhoto ? 52 : 38,
      visionLabel: undefined,
      visionConfidence: undefined,
      visionObservations,
      farmerAnswers,
      answeredQuestionIds: answeredIdsFromIntake(params.priorAnswers),
      dap: params.investigation.dap,
    });
  },

  toFollowUpQuestion(
    generated: GeneratedFollowUpQuestion,
    _language: AdvisoryLanguage
  ): {
    id: string;
    kind: GeneratedFollowUpQuestion['kind'];
    text: string;
    choices: GeneratedFollowUpQuestion['choices'];
    purpose?: string;
    fromEvsi?: boolean;
  } {
    return {
      id: generated.id,
      kind: generated.kind,
      text: generated.text,
      choices: generated.choices,
      purpose: generated.purpose,
      fromEvsi: true,
    };
  },
};
