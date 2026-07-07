import type { MaiosHypothesis, MaiosPhotoEvidence } from '../../domain/case/types.js';
import type { MaiosRoute } from '../../domain/case/types.js';
import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { VisitAiContextPack } from '../core/visit-ai-context.service.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import {
  maiosReasoningPipelineService,
  type MaiosReasoningPipelineInput,
} from './maios-reasoning-pipeline.service.js';

function weatherContextFromVisit(context: VisitAiContextPack): MaiosReasoningPipelineInput['contextPack'] {
  const snap = context.weatherSnapshot as Record<string, unknown> | null;
  if (!snap) return undefined;
  const alerts = Array.isArray(snap.diseaseAlerts) ? (snap.diseaseAlerts as string[]) : [];
  return {
    weatherRiskScore:
      typeof snap.weatherRiskScore === 'number' ? snap.weatherRiskScore : undefined,
    heavyRainLikely: alerts.includes('heavy_rain_likely'),
    highHeatLikely: alerts.includes('high_heat_likely'),
    highHumidityLikely: alerts.includes('high_humidity_likely'),
    soilPh:
      typeof context.soilTestSummary?.metrics === 'object' &&
      context.soilTestSummary?.metrics != null &&
      typeof (context.soilTestSummary.metrics as Record<string, unknown>).ph === 'number'
        ? Number((context.soilTestSummary.metrics as Record<string, unknown>).ph)
        : undefined,
  };
}

function visitPhotosToEvidence(
  photoCount: number,
  pack: Awaited<ReturnType<typeof cropPackLoaderService.load>>
): MaiosPhotoEvidence[] {
  if (photoCount <= 0) return [];
  const slots = pack.photoSlots.slice(0, photoCount);
  return slots.map((slot, i) => ({
    slot: slot.id,
    status: 'captured' as const,
    qualityScore: i === 0 ? 82 : 75,
  }));
}

function hypothesesToMaios(
  rows: Array<{ label: string; confidence: number }>
): MaiosHypothesis[] {
  return rows.map((h) => ({
    label: h.label,
    probability: Math.round(h.confidence * 100),
    source: 'M1' as const,
  }));
}

function estimateVisitEqs(photoCount: number, measurementCount: number): number {
  return Math.min(85, 45 + photoCount * 12 + Math.min(measurementCount, 4) * 4);
}

export type VisitReasoningAdapterInput = {
  context: VisitAiContextPack;
  issueName: string;
  observation?: string;
  hypotheses: Array<{ label: string; confidence: number; rationale?: string; imagePrediction?: string; imageConfidence?: number; selected?: boolean }>;
  imageSignal?: { label: string; confidence: number; observations?: Array<{ feature: string; value: string; confidence: number }> } | null;
  analyzePhotoCount?: number;
  farmerAnswers?: Array<{ questionId?: string; questionText: string; answer: string }>;
  answeredQuestionIds?: string[];
};

export type VisitHypothesisRow = VisitReasoningAdapterInput['hypotheses'][number];

export type WhatsAppReasoningAdapterInput = {
  cropType: string;
  symptomsText?: string;
  contextPack?: MaiosReasoningPipelineInput['contextPack'];
  hypotheses: MaiosHypothesis[];
  photos: MaiosPhotoEvidence[];
  eqs: number;
  maiosRoute?: MaiosRoute;
  escalationRecommended?: boolean;
  visionLabel?: string | null;
  visionConfidence?: number;
  farmerAnswers?: Array<{ questionId?: string; questionText: string; answer: string }>;
  answeredQuestionIds?: string[];
  harvestWithinDays?: number | null;
  dap?: number | null;
  visionObservations?: Array<{ feature: string; value: string; confidence: number }>;
};

/** When shadow mode is off, Bayesian posterior replaces LLM hypothesis ranking on visit path. */
export function applyBayesianToVisitHypotheses<T extends VisitHypothesisRow>(
  hypotheses: T[],
  reasoning: MaiosReasoningSnapshot | null
): T[] {
  if (!reasoning || reasoning.shadowMode || !hypotheses.length) return hypotheses;

  const byLabel = new Map(hypotheses.map((h) => [h.label.toLowerCase(), h]));
  const ranked = reasoning.posterior
    .filter((p) => p.label !== 'Unknown' && p.probability >= 0.05)
    .slice(0, 5)
    .map((p) => {
      const orig = byLabel.get(p.label.toLowerCase());
      return {
        ...(orig ?? ({} as T)),
        label: p.label,
        confidence: p.probability,
        rationale: orig?.rationale ?? `Bayesian posterior ${Math.round(p.probability * 100)}%`,
      } as T;
    });

  return ranked.length ? ranked : hypotheses;
}

/** Adapters that run v17 reasoning from visit wizard and WhatsApp without replacing existing LLM paths. */
export const maiosReasoningAdapterService = {
  async fromVisit(input: VisitReasoningAdapterInput): Promise<MaiosReasoningSnapshot | null> {
    if (!maiosReasoningPipelineService.isEnabled()) return null;

    const pack = await cropPackLoaderService.load(input.context.cropType);
    const photoCount = input.analyzePhotoCount ?? 0;
    const photos = visitPhotosToEvidence(photoCount, pack);
    const eqs = estimateVisitEqs(photoCount, input.context.measurements.length);

    return maiosReasoningPipelineService.run({
      cropType: input.context.cropType,
      pack,
      symptomsText: [input.issueName, input.observation].filter(Boolean).join(' — '),
      contextPack: weatherContextFromVisit(input.context),
      photos,
      hypotheses: hypothesesToMaios(input.hypotheses),
      eqs,
      maiosRoute: 'field_visit',
      escalationRecommended: false,
      visionLabel: input.imageSignal?.label ?? input.hypotheses[0]?.label,
      visionConfidence: input.imageSignal?.confidence ?? input.hypotheses[0]?.confidence,
      visionObservations: input.imageSignal?.observations,
      farmerAnswers: input.farmerAnswers,
      answeredQuestionIds: input.answeredQuestionIds,
      dap: input.context.dap,
    });
  },

  async fromWhatsApp(input: WhatsAppReasoningAdapterInput): Promise<MaiosReasoningSnapshot | null> {
    if (!maiosReasoningPipelineService.isEnabled()) return null;

    const pack = await cropPackLoaderService.load(input.cropType);
    return maiosReasoningPipelineService.run({
      cropType: input.cropType,
      pack,
      symptomsText: input.symptomsText,
      contextPack: input.contextPack,
      photos: input.photos,
      hypotheses: input.hypotheses,
      eqs: input.eqs,
      maiosRoute: input.maiosRoute ?? 'auto_recommend',
      escalationRecommended: input.escalationRecommended,
      visionLabel: input.visionLabel,
      visionConfidence: input.visionConfidence,
      farmerAnswers: input.farmerAnswers,
      answeredQuestionIds: input.answeredQuestionIds,
      visionObservations: input.visionObservations,
      dap: input.dap,
      harvestWithinDays: input.harvestWithinDays,
    });
  },
};
