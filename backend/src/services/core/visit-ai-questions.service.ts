import { env } from '../../config/env.js';
import { maxQuestionsForConfidence } from '../../domain/visit-ai/question-count.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import { VISIT_AI_QUESTION_GENERATOR_SYSTEM } from '../ai/prompts/visit-ai-question-generator.prompt.js';
import { visitAiPromptContextService } from './visit-ai-prompt-context.service.js';
import type { VisitAiContextPack } from './visit-ai-context.service.js';
import type { VisitImageSignal } from './visit-ai-image.service.js';
import type { FollowUpQuestionKind } from '../whatsapp/pipeline/follow-up-question.types.js';

export type VisitFollowUpQuestionDraft = {
  questionText: string;
  answerType: 'yes_no_unknown' | 'text' | 'number';
  sourceLibraryId?: string;
  kind?: FollowUpQuestionKind;
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

const GENERIC_QUESTION_RE =
  /what measures|samples? (been )?collected|additional observations?|any other (issues|problems)|describe the symptoms|what specific symptoms|general condition|overall health/i;

const OPEN_ENDED_RE = /^(what|which|how|describe|list|explain)\b/i;

function normalizeAnswerType(raw: string | undefined): VisitFollowUpQuestionDraft['answerType'] {
  if (raw === 'number') return 'number';
  if (raw === 'text') return 'text';
  return 'yes_no_unknown';
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isHighValueQuestion(
  text: string,
  answerType: VisitFollowUpQuestionDraft['answerType']
): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 8) return false;
  if (GENERIC_QUESTION_RE.test(trimmed)) return false;
  if (answerType === 'yes_no_unknown' && OPEN_ENDED_RE.test(trimmed)) return false;
  if (wordCount(trimmed) > 24) return false;
  return true;
}

async function planDynamicQuestions(params: {
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

  const contextBlock = await visitAiPromptContextService.buildPromptBlock({
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
  });

  const diffLines = (params.hypotheses ?? []).slice(0, 5).map((h, i) => {
    const pct = Math.round(h.confidence * 100);
    const rationale = h.rationale ? ` — ${h.rationale.slice(0, 100)}` : '';
    return `${i + 1}. ${h.label} (${pct}%)${rationale}`;
  });

  const confidencePct = Math.round(params.topConfidence * 100);

  const userPrompt = [
    contextBlock,
    '',
    `=== DIAGNOSTIC STATE ===`,
    `Primary hypothesis: ${params.selectedHypothesis}`,
    `Top confidence: ${confidencePct}%`,
    diffLines.length ? `Differential hypotheses:\n${diffLines.join('\n')}` : null,
    params.photoCount ? `Visit photos attached: ${params.photoCount}` : null,
    '',
    `Generate at most ${params.max} high-value question(s).`,
    params.max === 0
      ? 'Confidence is already ≥95% — return an empty questions array.'
      : 'If no question would materially change diagnosis or treatment, return an empty questions array.',
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
      if (!isHighValueQuestion(text, answerType)) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      drafts.push({
        questionText: text,
        answerType,
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
