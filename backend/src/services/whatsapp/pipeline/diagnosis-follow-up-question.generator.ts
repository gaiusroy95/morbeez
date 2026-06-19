import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { openaiJsonCompletion } from '../../ai/providers/openai.provider.js';
import type { AdvisoryLanguage } from '../../ai/types.js';
import type { InvestigationContext } from './diagnosis-follow-up-reasoning.engine.js';
import {
  normalizeChoiceOptions,
  normalizeFollowUpKind,
  type FollowUpChoiceOption,
  type FollowUpQuestionKind,
} from './follow-up-question.types.js';

export type { FollowUpChoiceOption, FollowUpQuestionKind };

export type GeneratedFollowUpQuestion = {
  id: string;
  kind: FollowUpQuestionKind;
  text: string;
  choices: FollowUpChoiceOption[];
  purpose?: string;
};

export type LearnedInvestigationPattern = {
  initialSymptoms: string;
  issueLabel: string;
  qa: Array<{ question: string; answer: string; kind?: string }>;
};

export type PlanNextQuestionInput = {
  ctx: InvestigationContext;
  priorAnswers: Record<string, string>;
  questionTexts: Record<string, string>;
  questionsAsked: number;
  maxQuestions: number;
  learnedPatterns: LearnedInvestigationPattern[];
  /** MAIOS v12 — missing evidence slots from case (photo/module gaps) */
  evidenceGaps?: string[];
};

export type PostDiagnosisAdvisorySnapshot = {
  probableIssue: string;
  confidence: number;
  uncertain?: boolean;
  imageObservations?: string[];
  stressAnalysis?: string[];
  differentialDiagnosis?: Array<{ label: string; reason: string; probability?: number }>;
  rejectedHypotheses?: string[];
};

export type PlanPostDiagnosisQuestionInput = {
  ctx: InvestigationContext;
  advisory: PostDiagnosisAdvisorySnapshot;
  priorAnswers: Record<string, string>;
  questionTexts: Record<string, string>;
  questionsAsked: number;
  maxQuestions: number;
  learnedPatterns: LearnedInvestigationPattern[];
};

export type PlanNextQuestionResult = {
  intakeComplete: boolean;
  question?: GeneratedFollowUpQuestion;
  rationale?: string;
};

const SYSTEM_PROMPT = `You are Morbeez follow-up question planner for Indian crop farmers on WhatsApp.

Your job: decide the SINGLE best next follow-up question OR mark intake complete.

RULES:
- ONLY structured response types: yes_no (2 choices), multiple_choice (2–8 options), or photo (image request).
- NEVER use open text / free typing questions.
- Learn from verified investigation patterns; after expert-saved questions are used, add NEW questions only if needed.
- Do NOT repeat what the farmer already stated in initial symptoms or prior answers.
- multiple_choice: provide 2–8 clear tap options (e.g. spray timing, severity bands, symptom patterns).
- yes_no: omit choices array (system adds Yes/No).
- photo: omit choices array (farmer sends image or skip).
- Write question text in English and Malayalam.
- questionId: short snake_case slug (unique within session).

Output JSON only:
{
  "intakeComplete": boolean,
  "rationale": "why this question or why done",
  "question": {
    "questionId": "snake_case",
    "kind": "yes_no" | "multiple_choice" | "photo",
    "textEn": "English question",
    "textMl": "Malayalam question",
    "purpose": "what diagnosis gap this fills",
    "choices": [
      { "id": "option_slug", "labelEn": "...", "labelMl": "..." }
    ]
  }
}
When intakeComplete is true, omit question or set null.`;

const POST_DIAGNOSIS_SYSTEM_PROMPT = `You are Morbeez post-diagnosis clarification planner for Indian crop farmers on WhatsApp.

Crop Doctor already analyzed farmer photos and produced a preliminary diagnosis with confidence below the review threshold.

Your job: plan the SINGLE best next structured follow-up question to discriminate between the primary hypothesis and alternatives — OR mark intake complete when farmer answers already resolve the differential.

RULES:
- Base every question ONLY on the provided preliminary diagnosis, differentialDiagnosis, imageObservations, and stressAnalysis. Do NOT use a fixed question bank.
- Each question must target a specific gap between the top hypothesis and a named alternative (or confirm a key field sign not visible in photos).
- NEVER repeat what photos already established or what the farmer already answered.
- ONLY structured types: yes_no (2 choices), multiple_choice (2–8 options), or photo (image request).
- NEVER use open text questions.
- multiple_choice: provide 2–8 clear tap options.
- yes_no: omit choices array (system adds Yes/No).
- photo: omit choices array (farmer sends image or skip).
- Write question text in English and Malayalam.
- questionId: short snake_case slug (unique within session).

Output JSON only:
{
  "intakeComplete": boolean,
  "rationale": "why this question or why done",
  "question": {
    "questionId": "snake_case",
    "kind": "yes_no" | "multiple_choice" | "photo",
    "textEn": "English question",
    "textMl": "Malayalam question",
    "purpose": "which differential gap this closes",
    "choices": [
      { "id": "option_slug", "labelEn": "...", "labelMl": "..." }
    ]
  }
}
When intakeComplete is true, omit question or set null.`;

function sanitizeQuestionId(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || `q_${Date.now()}`;
}

function localizeQuestion(
  row: { textEn?: string; textMl?: string },
  lang: AdvisoryLanguage
): string {
  if (lang === 'ml' && row.textMl?.trim()) return row.textMl.trim();
  return (row.textEn ?? row.textMl ?? '').trim();
}

function formatAnswerHuman(ans: string): string {
  if (ans === 'yes') return 'Yes';
  if (ans === 'no') return 'No';
  if (ans === 'skip') return 'Skipped';
  if (ans === 'within_7d') return 'Within last 7 days';
  if (ans === 'over_14d') return '14+ days ago';
  if (ans === 'never') return 'Not yet / no spray';
  return ans;
}

function buildUserPrompt(input: PlanNextQuestionInput): string {
  const { ctx, priorAnswers, questionTexts, questionsAsked, maxQuestions, learnedPatterns } =
    input;

  const priorLines = Object.entries(priorAnswers).map(([id, ans]) => {
    const q = questionTexts[id] ?? id;
    return `- Q: ${q}\n  A: ${formatAnswerHuman(ans)}`;
  });

  const patternLines = learnedPatterns.slice(0, 8).map((p, i) => {
    const qa = p.qa.map((x) => `    • "${x.question}" → ${formatAnswerHuman(x.answer)}`).join('\n');
    return `${i + 1}. Issue: ${p.issueLabel}\n   Initial: ${p.initialSymptoms.slice(0, 180)}\n${qa}`;
  });

  return [
    `Crop: ${ctx.cropType}`,
    `Language: ${ctx.language}`,
    `Has photo: ${ctx.hasPhoto}`,
    ctx.dap != null ? `Crop stage: ${ctx.dap} DAP` : null,
    `Match confidence: ${(ctx.matchConfidence * 100).toFixed(0)}%`,
    ctx.bestIssueLabel ? `Closest learned issue: ${ctx.bestIssueLabel}` : null,
    ctx.heavyRainLikely ? 'Weather: heavy rain likely' : null,
    ctx.highHumidityLikely ? 'Weather: high humidity' : null,
    `Initial farmer message:\n${ctx.symptomsText.trim().slice(0, 600)}`,
    '',
    priorLines.length
      ? `Already asked (${questionsAsked}/${maxQuestions}):\n${priorLines.join('\n')}`
      : `No follow-ups asked yet (${questionsAsked}/${maxQuestions} max).`,
    '',
    patternLines.length
      ? `Verified patterns from similar cases:\n${patternLines.join('\n\n')}`
      : 'No prior patterns — ask the most diagnostic structured question.',
    input.evidenceGaps?.length
      ? `MAIOS evidence gaps (prioritize closing these): ${input.evidenceGaps.join(', ')}`
      : null,
    '',
    questionsAsked >= maxQuestions
      ? 'Question budget exhausted — set intakeComplete true.'
      : 'Plan the next single structured question (yes/no, multiple choice, or photo).',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPostDiagnosisUserPrompt(input: PlanPostDiagnosisQuestionInput): string {
  const { ctx, advisory, priorAnswers, questionTexts, questionsAsked, maxQuestions, learnedPatterns } =
    input;

  const priorLines = Object.entries(priorAnswers).map(([id, ans]) => {
    const q = questionTexts[id] ?? id;
    return `- Q: ${q}\n  A: ${formatAnswerHuman(ans)}`;
  });

  const diffLines = (advisory.differentialDiagnosis ?? []).slice(0, 6).map((d, i) => {
    const prob =
      d.probability != null ? ` (${Math.round(d.probability * 100)}%)` : '';
    return `${i + 1}. ${d.label}${prob}${d.reason ? ` — ${d.reason}` : ''}`;
  });

  const obsLines = (advisory.imageObservations ?? []).slice(0, 6).map((o) => `- ${o}`);
  const stressLines = (advisory.stressAnalysis ?? []).slice(0, 4).map((s) => `- ${s}`);
  const rejected = (advisory.rejectedHypotheses ?? []).slice(0, 4);

  const patternLines = learnedPatterns.slice(0, 6).map((p, i) => {
    const qa = p.qa.map((x) => `    • "${x.question}" → ${formatAnswerHuman(x.answer)}`).join('\n');
    return `${i + 1}. Issue: ${p.issueLabel}\n   Initial: ${p.initialSymptoms.slice(0, 160)}\n${qa}`;
  });

  return [
    `Crop: ${ctx.cropType}`,
    `Language: ${ctx.language}`,
    `Preliminary diagnosis: ${advisory.probableIssue}`,
    `AI confidence: ${(advisory.confidence * 100).toFixed(0)}%`,
    advisory.uncertain ? 'Flagged uncertain by Crop Doctor' : null,
    '',
    diffLines.length
      ? `Differential diagnosis (ranked alternatives to discriminate):\n${diffLines.join('\n')}`
      : 'No differential list — ask the most diagnostic field confirmation question.',
    obsLines.length ? `\nImage observations already extracted:\n${obsLines.join('\n')}` : null,
    stressLines.length ? `\nStress analysis:\n${stressLines.join('\n')}` : null,
    rejected.length ? `\nRejected hypotheses: ${rejected.join('; ')}` : null,
    ctx.heavyRainLikely ? 'Weather: heavy rain likely' : null,
    ctx.highHumidityLikely ? 'Weather: high humidity' : null,
    '',
    priorLines.length
      ? `Already asked (${questionsAsked}/${maxQuestions}):\n${priorLines.join('\n')}`
      : `No clarification questions yet (${questionsAsked}/${maxQuestions} max).`,
    '',
    patternLines.length
      ? `Verified patterns from similar cases (learn question style, not copy verbatim):\n${patternLines.join('\n\n')}`
      : null,
    '',
    questionsAsked >= maxQuestions
      ? 'Question budget exhausted — set intakeComplete true.'
      : 'Plan the next single structured question to raise confidence or rule out the top alternative.',
  ]
    .filter(Boolean)
    .join('\n');
}

async function planStructuredQuestion(
  systemPrompt: string,
  userPrompt: string,
  input: { priorAnswers: Record<string, string>; questionsAsked: number; maxQuestions: number; language: AdvisoryLanguage }
): Promise<PlanNextQuestionResult> {
  if (!env.OPENAI_API_KEY) {
    logger.warn('Follow-up planner: OpenAI not configured — skipping intake');
    return { intakeComplete: true, rationale: 'openai_unavailable' };
  }

  if (input.questionsAsked >= input.maxQuestions) {
    return { intakeComplete: true, rationale: 'max_questions_reached' };
  }

  try {
    const raw = await openaiJsonCompletion<Record<string, unknown>>(systemPrompt, userPrompt, 900);

    if (Boolean(raw.intakeComplete)) {
      return {
        intakeComplete: true,
        rationale: String(raw.rationale ?? 'model_complete'),
      };
    }

    const q = raw.question as Record<string, unknown> | null | undefined;
    if (!q || typeof q !== 'object') {
      return { intakeComplete: true, rationale: 'no_question_generated' };
    }

    const id = sanitizeQuestionId(String(q.questionId ?? q.id ?? ''));
    if (input.priorAnswers[id] !== undefined) {
      return { intakeComplete: true, rationale: 'duplicate_question_id' };
    }

    const kind = normalizeFollowUpKind(q.kind);
    const choices = normalizeChoiceOptions(q.choices, kind);

    const text = localizeQuestion(
      { textEn: String(q.textEn ?? ''), textMl: String(q.textMl ?? '') },
      input.language
    );
    if (!text || text.length < 8) {
      return { intakeComplete: true, rationale: 'empty_question_text' };
    }

    return {
      intakeComplete: false,
      rationale: String(raw.rationale ?? ''),
      question: {
        id,
        kind,
        text,
        choices,
        purpose: q.purpose ? String(q.purpose) : undefined,
      },
    };
  } catch (err) {
    logger.warn({ err }, 'Follow-up question generation failed — proceeding to diagnosis');
    return { intakeComplete: true, rationale: 'generation_error' };
  }
}

export const diagnosisFollowUpQuestionGenerator = {
  async planNextQuestion(input: PlanNextQuestionInput): Promise<PlanNextQuestionResult> {
    return planStructuredQuestion(SYSTEM_PROMPT, buildUserPrompt(input), {
      priorAnswers: input.priorAnswers,
      questionsAsked: input.questionsAsked,
      maxQuestions: input.maxQuestions,
      language: input.ctx.language,
    });
  },

  async planPostDiagnosisQuestion(
    input: PlanPostDiagnosisQuestionInput
  ): Promise<PlanNextQuestionResult> {
    return planStructuredQuestion(
      POST_DIAGNOSIS_SYSTEM_PROMPT,
      buildPostDiagnosisUserPrompt(input),
      {
        priorAnswers: input.priorAnswers,
        questionsAsked: input.questionsAsked,
        maxQuestions: input.maxQuestions,
        language: input.ctx.language,
      }
    );
  },

  buildInvestigationPattern(params: {
    initialSymptoms: string;
    issueLabel: string;
    answers: Record<string, string>;
    questionTexts: Record<string, string>;
    questionKinds: Record<string, FollowUpQuestionKind>;
    questionChoices: Record<string, FollowUpChoiceOption[]>;
  }): LearnedInvestigationPattern {
    const qa = Object.entries(params.answers)
      .filter(([, ans]) => ans !== 'skip')
      .map(([id, answer]) => ({
        question: params.questionTexts[id] ?? id,
        answer,
        kind: params.questionKinds[id],
      }));
    return {
      initialSymptoms: params.initialSymptoms.trim().slice(0, 400),
      issueLabel: params.issueLabel.trim().slice(0, 200),
      qa,
    };
  },
};
