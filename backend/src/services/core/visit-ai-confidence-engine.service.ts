import {
  applyEvidenceDeltas,
  buildHypothesisDistribution,
  distributionThresholdReached,
  type EvidenceDelta,
  type HypothesisDistribution,
  DEFAULT_TARGET_CONFIDENCE,
} from '../../domain/visit-ai/confidence-distribution.js';
import { resolveConfidenceAction } from '../../domain/ai-training/confidence-routing.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';

export type ConfidenceState = {
  distribution: HypothesisDistribution;
  thresholdReached: boolean;
  topLabel: string | null;
  confidenceAction: string;
  nextQuestion: {
    id: string;
    questionText: string;
    answerType: string;
  } | null;
};

type QuestionRow = {
  id: string;
  question_text: string;
  answer_type: string;
  answer: string | null;
  metadata: Record<string, unknown> | null;
};

async function getCaseOrThrow(aiCaseId: string) {
  const { data, error } = await supabase.from('visit_ai_cases').select('*').eq('id', aiCaseId).maybeSingle();
  throwIfSupabaseError(error, 'Could not load AI case');
  if (!data) throw new NotFoundError('AI case not found');
  return data;
}

function loadDistributionFromMeta(meta: Record<string, unknown>, hypotheses: Array<{ label: string; confidence: number }>): HypothesisDistribution {
  const stored = meta.confidenceDistribution as HypothesisDistribution | undefined;
  if (stored?.hypotheses?.length) return stored;
  return buildHypothesisDistribution(
    hypotheses.map((h) => ({ label: h.label, confidence: h.confidence })),
    (meta.targetConfidence as number) ?? DEFAULT_TARGET_CONFIDENCE
  );
}

async function persistDistribution(aiCaseId: string, dist: HypothesisDistribution, meta: Record<string, unknown>) {
  const nextMeta = {
    ...meta,
    confidenceDistribution: dist,
    unknownWeight: dist.unknownWeight,
    targetConfidence: dist.targetConfidence,
  };
  await supabase
    .from('visit_ai_cases')
    .update({
      metadata: nextMeta,
      final_confidence: dist.topConfidence,
      updated_at: new Date().toISOString(),
    })
    .eq('id', aiCaseId);

  for (let i = 0; i < dist.hypotheses.length; i++) {
    const h = dist.hypotheses[i]!;
    await supabase
      .from('visit_ai_hypotheses')
      .update({ confidence: h.weight / 100, sort_order: i, selected: i === 0 })
      .eq('visit_ai_case_id', aiCaseId)
      .eq('label', h.label);
  }
}

/** Rule-based evidence deltas from question text + answer. */
function inferEvidenceDeltas(
  questionText: string,
  answer: string,
  hypotheses: HypothesisWeight[]
): EvidenceDelta[] | null {
  const q = questionText.toLowerCase();
  const a = answer.toLowerCase().trim();
  if (!a || a === 'unknown' || a === 'not checked') return null;

  const yes = a === 'yes' || a === 'true';
  const no = a === 'no' || a === 'false';
  if (!yes && !no) return null;

  const top = hypotheses[0]?.label;
  if (!top) return null;

  const deltas: EvidenceDelta[] = [];

  if (/heavy rain|waterlog|flooding|rain.*7 day/i.test(q)) {
    if (yes) {
      deltas.push({ label: top, delta: 8 });
      deltas.push({ label: 'Unknown', delta: -4 });
      for (const h of hypotheses.slice(1, 3)) {
        deltas.push({ label: h.label, delta: -2 });
      }
      return deltas;
    }
    if (no) {
      deltas.push({ label: 'Unknown', delta: -2 });
      return deltas;
    }
  }

  if (/root.*soft|rotting|rhizome|root rot/i.test(q)) {
    if (yes) {
      deltas.push({ label: top, delta: 12 });
      deltas.push({ label: 'Unknown', delta: -4 });
      for (const h of hypotheses.slice(1, 3)) {
        deltas.push({ label: h.label, delta: -3 });
      }
      return deltas;
    }
  }

  if (/thrips|silver streak|pest|mite/i.test(q)) {
    const pestLabel = hypotheses.find((h) => /thrip|mite|pest/i.test(h.label))?.label;
    if (yes && pestLabel) {
      deltas.push({ label: pestLabel, delta: 10 });
      deltas.push({ label: 'Unknown', delta: -3 });
      if (top && pestLabel !== top) deltas.push({ label: top, delta: -4 });
      return deltas;
    }
    if (no && pestLabel) {
      deltas.push({ label: pestLabel, delta: -8 });
      deltas.push({ label: 'Unknown', delta: -2 });
      return deltas;
    }
  }

  if (/zinc|zn|nutrient|deficien/i.test(q)) {
    const znLabel = hypotheses.find((h) => /zn|zinc|nutrient/i.test(h.label))?.label;
    if (yes && znLabel) {
      deltas.push({ label: znLabel, delta: 10 });
      deltas.push({ label: 'Unknown', delta: -3 });
      return deltas;
    }
  }

  return null;
}

type HypothesisWeight = { label: string; weight: number };

async function loadQuestions(aiCaseId: string): Promise<QuestionRow[]> {
  const { data, error } = await supabase
    .from('visit_ai_questions')
    .select('id, question_text, answer_type, answer, metadata')
    .eq('visit_ai_case_id', aiCaseId)
    .order('sort_order', { ascending: true });
  throwIfSupabaseError(error, 'Could not load questions');
  return (data ?? []) as QuestionRow[];
}

function nextUnanswered(questions: QuestionRow[]) {
  const q = questions.find((row) => !row.answer?.trim());
  if (!q) return null;
  return {
    id: String(q.id),
    questionText: String(q.question_text),
    answerType: String(q.answer_type),
  };
}

function buildConfidenceState(dist: HypothesisDistribution, questions: QuestionRow[]): ConfidenceState {
  const thresholdReached = distributionThresholdReached(dist);
  const topLabel = dist.hypotheses[0]?.label ?? null;
  return {
    distribution: dist,
    thresholdReached,
    topLabel,
    confidenceAction: resolveConfidenceAction(dist.topConfidence),
    nextQuestion: thresholdReached ? null : nextUnanswered(questions),
  };
}

export const visitAiConfidenceEngineService = {
  async getConfidenceState(aiCaseId: string): Promise<ConfidenceState> {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const meta = (caseRow.metadata as Record<string, unknown>) ?? {};

    const { data: hypothesisRows } = await supabase
      .from('visit_ai_hypotheses')
      .select('label, confidence')
      .eq('visit_ai_case_id', aiCaseId)
      .order('sort_order', { ascending: true });

    const dist = loadDistributionFromMeta(
      meta,
      (hypothesisRows ?? []).map((h) => ({
        label: String(h.label),
        confidence: Number(h.confidence),
      }))
    );

    const questions = await loadQuestions(aiCaseId);
    return buildConfidenceState(dist, questions);
  },

  async initializeFromHypotheses(
    aiCaseId: string,
    hypotheses: Array<{ label: string; confidence: number }>
  ): Promise<ConfidenceState> {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const meta = (caseRow.metadata as Record<string, unknown>) ?? {};
    const dist = buildHypothesisDistribution(hypotheses);
    await persistDistribution(aiCaseId, dist, meta);
    const questions = await loadQuestions(aiCaseId);
    return buildConfidenceState(dist, questions);
  },

  async applyAnswer(
    aiCaseId: string,
    questionId: string,
    answer: string
  ): Promise<ConfidenceState & { deltas: EvidenceDelta[] }> {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const meta = (caseRow.metadata as Record<string, unknown>) ?? {};

    const { data: qRow, error: qErr } = await supabase
      .from('visit_ai_questions')
      .select('id, question_text, answer_type, answer, metadata')
      .eq('id', questionId)
      .eq('visit_ai_case_id', aiCaseId)
      .maybeSingle();
    throwIfSupabaseError(qErr, 'Could not load question');
    if (!qRow) throw new NotFoundError('Question not found');

    await supabase
      .from('visit_ai_questions')
      .update({ answer: answer.trim(), answered_at: new Date().toISOString() })
      .eq('id', questionId);

    const { data: hypothesisRows } = await supabase
      .from('visit_ai_hypotheses')
      .select('label, confidence')
      .eq('visit_ai_case_id', aiCaseId)
      .order('sort_order', { ascending: true });

    let dist = loadDistributionFromMeta(
      meta,
      (hypothesisRows ?? []).map((h) => ({
        label: String(h.label),
        confidence: Number(h.confidence),
      }))
    );

    const ruleDeltas = inferEvidenceDeltas(
      String(qRow.question_text),
      answer,
      dist.hypotheses
    );
    const deltas = ruleDeltas ?? [
      { label: dist.hypotheses[0]?.label ?? 'Unknown', delta: 2 },
      { label: 'Unknown', delta: -2 },
    ];

    dist = applyEvidenceDeltas(dist, deltas);
    await persistDistribution(aiCaseId, dist, meta);

    const questions = await loadQuestions(aiCaseId);
    const state = buildConfidenceState(dist, questions);
    return { ...state, deltas };
  },
};
