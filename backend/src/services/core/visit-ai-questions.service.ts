import { env } from '../../config/env.js';
import { maxQuestionsForConfidence } from '../../domain/visit-ai/question-count.js';
import {
  isHighValueVisitQuestion,
  type VisitQuestionAnswerType,
} from '../../domain/visit-ai/question-quality.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import { VISIT_AI_QUESTION_GENERATOR_SYSTEM } from '../ai/prompts/visit-ai-question-generator.prompt.js';
import { cropDoctorReportContextService } from '../ai/crop-doctor-report-context.service.js';
import { visitAiPromptContextService } from './visit-ai-prompt-context.service.js';
import type { VisitAiContextPack } from './visit-ai-context.service.js';
import type { VisitImageSignal } from './visit-ai-image.service.js';
import type { FollowUpQuestionKind } from '../whatsapp/pipeline/follow-up-question.types.js';

export type VisitFollowUpQuestionDraft = {
  questionText: string;
  answerType: VisitQuestionAnswerType;
  sourceLibraryId?: string;
  kind?: FollowUpQuestionKind;
  purpose?: string;
};

export type VisitHypothesisHint = {
  label: string;
  confidence: number;
  rationale?: string;
};

export type VisitEvidenceHint = {
  photoSummary?: string;
  measurementSummary?: string;
  soilSummary?: string;
  weatherSummary?: string;
};

function normalizeAnswerType(raw: string | undefined): VisitQuestionAnswerType {
  if (raw === 'number') return 'number';
  if (raw === 'text') return 'text';
  return 'yes_no_unknown';
}

async function planDynamicQuestions(params: {
  farmerId: string;
  cropType: string;
  issueCategory: string;
  selectedHypothesis: string;
  observation?: string;
  context: VisitAiContextPack;
  imageSignal?: Pick<VisitImageSignal, 'label' | 'confidence' | 'observations'> | null;
  photoCount?: number;
  hypotheses?: VisitHypothesisHint[];
  topConfidence: number;
  max: number;
}): Promise<VisitFollowUpQuestionDraft[]> {
  if (!env.OPENAI_API_KEY || params.max <= 0) return [];

  const [contextBlock, reportCtx] = await Promise.all([
    visitAiPromptContextService.buildPromptBlock({
      context: params.context,
      issueCategory: params.issueCategory,
      issueName: params.selectedHypothesis,
      observation: params.observation,
      imageSignal: params.imageSignal
        ? {
            label: params.imageSignal.label,
            confidence: params.imageSignal.confidence,
            source: 'vision' as const,
            photoCount: params.photoCount ?? 0,
            observations: params.imageSignal.observations,
          }
        : null,
    }),
    cropDoctorReportContextService.build({
      farmerId: params.farmerId,
      blockId: params.context.blockId,
      cropType: params.cropType,
      currentIssue: params.selectedHypothesis,
    }),
  ]);

  const fieldHistoryBlock = [
    '=== FIELD HISTORY (do not re-ask if already known) ===',
    reportCtx.lastFertilizer
      ? `Last fertilizer: ${reportCtx.lastFertilizer.label} (${reportCtx.lastFertilizer.daysAgo ?? reportCtx.lastFertilizer.date ?? 'date unknown'})`
      : 'Last fertilizer: not recorded',
    reportCtx.lastFoliarSpray
      ? `Last foliar spray: ${reportCtx.lastFoliarSpray.label} (${reportCtx.lastFoliarSpray.daysAgo ?? reportCtx.lastFoliarSpray.date ?? 'date unknown'})`
      : 'Last foliar spray: not recorded',
    reportCtx.lastDrench
      ? `Last drench: ${reportCtx.lastDrench.label} (${reportCtx.lastDrench.daysAgo ?? reportCtx.lastDrench.date ?? 'date unknown'})`
      : 'Last drench: not recorded',
    `Previous diagnosis: ${reportCtx.previousDisease ?? 'not recorded'}`,
    '=== LATEST SOIL TEST ===',
    ...(reportCtx.soilReportLines?.length
      ? reportCtx.soilReportLines
      : [reportCtx.soilSummary ?? 'Not recorded']),
  ].join('\n');

  const diffLines = (params.hypotheses ?? []).slice(0, 5).map((h, i) => {
    const pct = Math.round(h.confidence * 100);
    const rationale = h.rationale ? ` — ${h.rationale.slice(0, 100)}` : '';
    return `${i + 1}. ${h.label} (${pct}%)${rationale}`;
  });

  const confidencePct = Math.round(params.topConfidence * 100);

  const userPrompt = [
    contextBlock,
    '',
    fieldHistoryBlock,
    '',
    `=== DIAGNOSTIC STATE ===`,
    `Crop: ${params.cropType}`,
    `Primary hypothesis: ${params.selectedHypothesis}`,
    `Top confidence: ${confidencePct}%`,
    `Max questions allowed: ${params.max}`,
    diffLines.length ? `Differential hypotheses:\n${diffLines.join('\n')}` : null,
    params.photoCount ? `Visit photos attached: ${params.photoCount} — do NOT ask to describe visible symptoms again` : null,
    '',
    `Generate up to ${params.max} high-value question(s). Fewer is better if additional answers will not change the diagnosis.`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const result = await openaiJsonCompletion<{
      questions: Array<{ text: string; answerType?: string; purpose?: string }>;
    }>(VISIT_AI_QUESTION_GENERATOR_SYSTEM, userPrompt, 768, { temperature: 0 });

    const drafts: VisitFollowUpQuestionDraft[] = [];
    const seen = new Set<string>();
    for (const q of result.questions ?? []) {
      const text = String(q.text ?? '').trim();
      const answerType = normalizeAnswerType(q.answerType);
      if (!isHighValueVisitQuestion(text, answerType)) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      drafts.push({
        questionText: text,
        answerType,
        purpose: q.purpose ? String(q.purpose) : undefined,
        kind: answerType === 'yes_no_unknown' ? 'yes_no' : undefined,
      });
      if (drafts.length >= params.max) break;
    }
    return drafts;
  } catch {
    return [];
  }
}

export const visitAiQuestionsService = {
  maxQuestionsForConfidence,
  isHighValueVisitQuestion,

  async buildVisitFollowUpQuestions(params: {
    farmerId: string;
    cropType: string;
    issueCategory: string;
    selectedHypothesis: string;
    observation?: string;
    context: VisitAiContextPack;
    imageSignal?: Pick<VisitImageSignal, 'label' | 'confidence' | 'observations'> | null;
    photoCount?: number;
    hypotheses?: VisitHypothesisHint[];
    evidence?: VisitEvidenceHint;
    topConfidence?: number;
    max?: number;
  }): Promise<VisitFollowUpQuestionDraft[]> {
    const topConfidence = params.topConfidence ?? params.hypotheses?.[0]?.confidence ?? 0.75;
    const max = params.max ?? maxQuestionsForConfidence(topConfidence);
    if (max <= 0) return [];

    return planDynamicQuestions({
      farmerId: params.farmerId,
      cropType: params.cropType,
      issueCategory: params.issueCategory,
      selectedHypothesis: params.selectedHypothesis,
      observation: params.observation,
      context: params.context,
      imageSignal: params.imageSignal,
      photoCount: params.photoCount,
      hypotheses: params.hypotheses,
      topConfidence,
      max,
    });
  },
};
