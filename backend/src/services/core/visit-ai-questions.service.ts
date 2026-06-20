import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { expertFollowUpLearningService } from './expert-follow-up-learning.service.js';
import { issueFollowUpQuestionsService } from './issue-follow-up-questions.service.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
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

const VISIT_GROUNDED_QA_SYSTEM = `You are Morbeez field-visit follow-up planner for agronomists visiting Indian farms.

Generate 3-5 short follow-up questions to help confirm or rule out the preliminary diagnosis using field facts NOT visible in photos.

RULES:
- Base every question ONLY on the preliminary diagnosis, differential hypotheses, photo/image evidence, measurements, and agronomist observation.
- imageSignal and photoSummary describe what the visit photos show — NEVER ask the agronomist to confirm signs that evidence ruled out.
- Do NOT use a generic question bank (avoid unrelated soil-test / micronutrient history unless it directly discriminates between listed hypotheses).
- Prefer: irrigation timing, symptom spread/progression, recent spray or fertilizer, pest on leaf undersides, weather impact, farmer actions since last visit.
- Each question must be specific to THIS case — not template filler.
- answerType: yes_no_unknown for most; text when a short free answer is better; number for counts or days.
- Keep questions concise (under 140 characters when possible).

Output JSON only:
{"questions":[{"text":"...","answerType":"yes_no_unknown|text|number","purpose":"which gap this closes"}]}`;

function kindToAnswerType(kind: FollowUpQuestionKind): VisitFollowUpQuestionDraft['answerType'] {
  if (kind === 'multiple_choice') return 'yes_no_unknown';
  return 'yes_no_unknown';
}

function normalizeAnswerType(raw: string | undefined): VisitFollowUpQuestionDraft['answerType'] {
  if (raw === 'number') return 'number';
  if (raw === 'text') return 'text';
  return 'yes_no_unknown';
}

async function getFarmerDistrict(farmerId: string): Promise<string | null> {
  const { data } = await supabase.from('farmers').select('district').eq('id', farmerId).maybeSingle();
  return data?.district ? String(data.district).trim().toLowerCase() : null;
}

async function planVisitGroundedQuestions(params: {
  cropType: string;
  issueCategory: string;
  selectedHypothesis: string;
  observation?: string;
  context: VisitAiContextPack;
  imageSignal?: Pick<VisitImageSignal, 'label' | 'confidence'> | null;
  photoCount?: number;
  hypotheses?: VisitHypothesisHint[];
  evidence?: VisitEvidenceHint;
  max: number;
}): Promise<VisitFollowUpQuestionDraft[]> {
  if (!env.OPENAI_API_KEY) return [];

  const diffLines = (params.hypotheses ?? []).slice(0, 5).map((h, i) => {
    const pct = Math.round(h.confidence * 100);
    const rationale = h.rationale ? ` — ${h.rationale.slice(0, 120)}` : '';
    return `${i + 1}. ${h.label} (${pct}%)${rationale}`;
  });

  const userPrompt = [
    `Crop: ${params.cropType}`,
    `DAP: ${params.context.dap ?? 'unknown'}`,
    `Issue category: ${params.issueCategory}`,
    `Preliminary diagnosis: ${params.selectedHypothesis}`,
    `Observation: ${params.observation ?? 'none'}`,
    params.imageSignal
      ? `Image signal: ${params.imageSignal.label} (${Math.round(params.imageSignal.confidence * 100)}% confidence)`
      : null,
    params.photoCount ? `Visit photos attached: ${params.photoCount}` : null,
    params.evidence?.photoSummary ? `Photo evidence: ${params.evidence.photoSummary}` : null,
    params.evidence?.measurementSummary ? `Measurements: ${params.evidence.measurementSummary}` : null,
    params.evidence?.soilSummary ? `Soil: ${params.evidence.soilSummary}` : null,
    params.evidence?.weatherSummary ? `Weather: ${params.evidence.weatherSummary}` : null,
    diffLines.length ? `\nDifferential hypotheses:\n${diffLines.join('\n')}` : null,
    `\nGenerate up to ${params.max} case-specific follow-up questions.`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const result = await openaiJsonCompletion<{
      questions: Array<{ text: string; answerType?: string }>;
    }>(VISIT_GROUNDED_QA_SYSTEM, userPrompt, 768);

    const drafts: VisitFollowUpQuestionDraft[] = [];
    const seen = new Set<string>();
    for (const q of result.questions ?? []) {
      const text = String(q.text ?? '').trim();
      if (!text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      drafts.push({
        questionText: text,
        answerType: normalizeAnswerType(q.answerType),
        kind: 'yes_no',
      });
      if (drafts.length >= params.max) break;
    }
    return drafts;
  } catch {
    return [];
  }
}

export const visitAiQuestionsService = {
  async buildVisitFollowUpQuestions(params: {
    farmerId: string;
    cropType: string;
    issueCategory: string;
    selectedHypothesis: string;
    observation?: string;
    context: VisitAiContextPack;
    imageSignal?: Pick<VisitImageSignal, 'label' | 'confidence'> | null;
    photoCount?: number;
    hypotheses?: VisitHypothesisHint[];
    evidence?: VisitEvidenceHint;
    max?: number;
  }): Promise<VisitFollowUpQuestionDraft[]> {
    const max = params.max ?? 5;
    const hasPhotoContext = Boolean(params.imageSignal || (params.photoCount ?? 0) > 0);
    const seen = new Set<string>();
    const drafts: VisitFollowUpQuestionDraft[] = [];

    if (hasPhotoContext) {
      const grounded = await planVisitGroundedQuestions({ ...params, max });
      for (const d of grounded) {
        const key = d.questionText.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        drafts.push(d);
      }
    }

    if (drafts.length >= max) return drafts.slice(0, max);

    const symptoms = [params.selectedHypothesis, params.observation ?? ''].filter(Boolean).join(' ');
    const district = await getFarmerDistrict(params.farmerId);

    if (!hasPhotoContext) {
      const library = await expertFollowUpLearningService.findForFarmer({
        cropType: params.cropType,
        district,
        symptomsText: symptoms,
        issueLabelHint: params.selectedHypothesis,
        language: 'en',
        max,
      });

      for (const q of library) {
        const key = q.textEn.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        drafts.push({
          questionText: q.textEn,
          answerType: kindToAnswerType(q.kind),
          sourceLibraryId: q.libraryId,
          kind: q.kind,
        });
        if (drafts.length >= max) break;
      }
    }

    if (drafts.length < max) {
      const fallbackTexts = await issueFollowUpQuestionsService.suggest({
        issueCategory: params.issueCategory,
        issueName: params.selectedHypothesis,
        cropType: params.cropType,
        dap: params.context.dap,
        observation: params.observation,
        photoCount: params.photoCount ?? 0,
        selectedHypothesis: params.selectedHypothesis,
        contextPack: {
          imageSignal: params.imageSignal ?? null,
          hypotheses: params.hypotheses ?? [],
          evidence: params.evidence ?? null,
        },
      });

      for (const text of fallbackTexts) {
        const t = text.trim();
        if (!t || seen.has(t.toLowerCase())) continue;
        seen.add(t.toLowerCase());
        drafts.push({ questionText: t, answerType: 'yes_no_unknown', kind: 'yes_no' });
        if (drafts.length >= max) break;
      }
    }

    if (drafts.length < 3 && env.OPENAI_API_KEY && !hasPhotoContext) {
      try {
        const extra = await openaiJsonCompletion<{ questions: Array<{ text: string; answerType?: string }> }>(
          'Return JSON {"questions":[{"text":"...","answerType":"yes_no_unknown|number|text"}]} with 2-3 short agronomy follow-up questions grounded in the case context.',
          `Crop: ${params.cropType}, DAP: ${params.context.dap}, Diagnosis: ${params.selectedHypothesis}, Observation: ${params.observation ?? 'none'}`,
          512
        );
        for (const q of extra.questions ?? []) {
          const t = String(q.text ?? '').trim();
          if (!t || seen.has(t.toLowerCase())) continue;
          seen.add(t.toLowerCase());
          drafts.push({
            questionText: t,
            answerType: normalizeAnswerType(q.answerType),
            kind: 'yes_no',
          });
          if (drafts.length >= max) break;
        }
      } catch {
        // ignore
      }
    }

    return drafts.slice(0, max);
  },
};
