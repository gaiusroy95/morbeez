import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { resolveConfidenceAction } from '../../domain/ai-training/confidence-routing.js';
import type { ReviewAction } from '../../domain/ai-training/enums.js';
import type {
  VisitAiRejectBody,
  VisitAnalyzeRequest,
  VisitAnalyzeVisitRequest,
  VisitAiAnswersBody,
} from '../../domain/ai-training/validators.js';
import type { VisitAiRejectReason } from '../../domain/ai-training/enums.js';
import { visitAiContextService } from './visit-ai-context.service.js';
import { visitAiQuestionsService } from './visit-ai-questions.service.js';
import { resolveVisitImagePredictions } from './visit-ai-image.service.js';
import { expertFollowUpLearningService } from './expert-follow-up-learning.service.js';
import { nearbyCasesService } from '../whatsapp/pipeline/nearby-cases.service.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import { buildSymptomKey } from '../ai/question-reuse-keys.util.js';
import { aiReuseService, buildDapBucket } from '../ai/ai-reuse.service.js';
import { blockService } from './block.service.js';

type HypothesisRow = {
  label: string;
  confidence: number;
  rationale?: string;
  selected?: boolean;
  imagePrediction?: string;
  imageConfidence?: number;
};

function clampConfidence(n: number): number {
  return Math.max(0.05, Math.min(0.98, n));
}

async function loadSimilarCases(
  farmerId: string,
  cropType: string,
  issueName: string,
  observation?: string
) {
  const symptoms = [issueName, observation ?? ''].filter(Boolean).join(' ');
  const symptomKey = buildSymptomKey(symptoms);
  const crop = cropType.toLowerCase();

  const { data: farmer } = await supabase.from('farmers').select('district').eq('id', farmerId).maybeSingle();
  const district = farmer?.district ? String(farmer.district).trim().toLowerCase() : null;
  const block = await blockService.getPrimaryBlock(farmerId).catch(() => null);
  const dapBucket = buildDapBucket(block?.dap ?? 0);

  const reusable = await aiReuseService.findReusableCase({
    cropType: crop,
    district,
    dapBucket,
    symptomKey,
  }).catch(() => null);

  const [{ data: reuseRows }, { data: samples }, nearby] = await Promise.all([
    supabase
      .from('advisory_reuse_cases')
      .select('issue_label, confidence_score, hit_count, outcome_ok')
      .eq('crop_type', crop)
      .eq('outcome_ok', true)
      .order('hit_count', { ascending: false })
      .limit(5),
    supabase
      .from('ai_learning_samples')
      .select('disease_label, outcome')
      .eq('crop_type', crop)
      .not('outcome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
    nearbyCasesService.summarize(farmerId, cropType),
  ]);

  const outcomeByLabel = new Map<string, string>();
  for (const s of samples ?? []) {
    const label = String(s.disease_label ?? '').trim();
    if (label && s.outcome) outcomeByLabel.set(label.toLowerCase(), String(s.outcome));
  }

  const fromReuse = (reuseRows ?? [])
    .filter((r) => r.issue_label)
    .map((r) => ({
      issueLabel: String(r.issue_label),
      score: Number(r.hit_count ?? 1) / 10,
      confidence: Number(r.confidence_score ?? 0.7),
      outcome: outcomeByLabel.get(String(r.issue_label).toLowerCase()) ?? null,
    }));

  if (reusable?.issueLabel) {
    fromReuse.unshift({
      issueLabel: reusable.issueLabel,
      score: 0.9,
      confidence: 0.88,
      outcome: outcomeByLabel.get(reusable.issueLabel.toLowerCase()) ?? 'better',
    });
  }

  const fromNearby = (nearby.recentIssues ?? []).slice(0, 3).map((r) => ({
    issueLabel: r.issueLabel,
    score: r.count / 10,
    confidence: 0.6,
    outcome: outcomeByLabel.get(r.issueLabel.toLowerCase()) ?? null,
  }));

  const combined = [...fromReuse, ...fromNearby];
  if (symptomKey && combined.length === 0) {
    combined.push({ issueLabel: issueName, score: 0.5, confidence: 0.65, outcome: null });
  }
  return combined.slice(0, 6);
}

function mergeImageIntoHypotheses(
  hypotheses: HypothesisRow[],
  imageSignal: Awaited<ReturnType<typeof resolveVisitImagePredictions>>
): HypothesisRow[] {
  if (!imageSignal) return hypotheses;
  const idx = hypotheses.findIndex(
    (h) => h.label.toLowerCase() === imageSignal.label.toLowerCase()
  );
  if (idx >= 0) {
    const updated = [...hypotheses];
    const row = updated[idx]!;
    updated[idx] = {
      ...row,
      confidence: clampConfidence(Math.max(row.confidence, imageSignal.confidence)),
      imagePrediction: imageSignal.label,
      imageConfidence: imageSignal.confidence,
      rationale: `${row.rationale ?? ''} Image analysis: ${Math.round(imageSignal.confidence * 100)}%.`.trim(),
    };
    return updated.sort((a, b) => b.confidence - a.confidence);
  }
  return [
    {
      label: imageSignal.label,
      confidence: imageSignal.confidence,
      rationale: `Image analysis (${imageSignal.source}, ${imageSignal.photoCount} photo(s)).`,
      imagePrediction: imageSignal.label,
      imageConfidence: imageSignal.confidence,
    },
    ...hypotheses,
  ].slice(0, 5);
}

async function buildHypotheses(params: {
  context: Awaited<ReturnType<typeof visitAiContextService.buildVisitAiContext>>;
  issueCategory: string;
  issueName: string;
  observation?: string;
  similarCases: Array<{ issueLabel: string; score: number; confidence: number }>;
}): Promise<HypothesisRow[]> {
  const primary: HypothesisRow = {
    label: params.issueName,
    confidence: 0.72,
    rationale: `Reported ${params.issueCategory.replace(/_/g, ' ')} on ${params.context.cropType}.`,
  };

  const fromSimilar = params.similarCases
    .filter((c) => c.issueLabel.toLowerCase() !== params.issueName.toLowerCase())
    .slice(0, 3)
    .map((c, i) => ({
      label: c.issueLabel,
      confidence: clampConfidence(c.confidence * (1 - i * 0.08)),
      rationale: 'Similar verified regional case.',
    }));

  if (env.OPENAI_API_KEY) {
    try {
      const prompt = `Crop: ${params.context.cropType}, DAP: ${params.context.dap ?? '?'}
Category: ${params.issueCategory}
Issue: ${params.issueName}
Observation: ${params.observation ?? 'none'}
Measurements: ${JSON.stringify(params.context.measurements)}
Weather: ${JSON.stringify(params.context.weatherSnapshot)}
Similar cases: ${params.similarCases.map((s) => s.issueLabel).join(', ') || 'none'}

Return JSON {"hypotheses":[{"label":"...","confidence":0.0-1.0,"rationale":"..."}]} with 2-4 ranked diagnoses.`;

      const result = await openaiJsonCompletion<{ hypotheses: HypothesisRow[] }>(
        'Rank agronomic diagnoses by likelihood. confidence is 0-1.',
        prompt,
        800
      );
      if (Array.isArray(result.hypotheses) && result.hypotheses.length) {
        return result.hypotheses
          .map((h, i) => ({
            label: String(h.label).trim(),
            confidence: clampConfidence(Number(h.confidence) || 0.5 - i * 0.05),
            rationale: h.rationale ? String(h.rationale) : undefined,
          }))
          .filter((h) => h.label)
          .slice(0, 5);
      }
    } catch {
      // fallback below
    }
  }

  return [primary, ...fromSimilar].slice(0, 4);
}

type DetectedVisitIssue = {
  category: string;
  issueName: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  observation?: string;
  rootCause: {
    symptoms: string[];
    photoSignals: string[];
    soilSignals: string[];
    weatherSignals: string[];
    conclusion: string;
  };
  evidence: {
    photoSummary: string;
    measurementSummary: string;
    soilSummary: string;
    weatherSummary: string;
    historySummary: string;
  };
};

function inferIssueCategory(label: string): string {
  const hay = label.toLowerCase();
  if (/deficien|nitrogen|phosphorus|potassium|zinc|magnesium|boron|iron/.test(hay)) return 'nutrient_deficiency';
  if (/pest|borer|thrips|nematode|insect|aphid/.test(hay)) return 'pest';
  if (/blight|rot|spot|wilt|mildew|rust|disease|bacterial|fungal/.test(hay)) return 'disease';
  if (/water|drought|moisture|logging/.test(hay)) return 'water_stress';
  if (/weed/.test(hay)) return 'weed';
  return 'other';
}

function inferSeverity(confidence: number, measurements: Array<{ key: string; value: string }>): 'low' | 'medium' | 'high' {
  const incidence = measurements.find((m) => /incidence/i.test(m.key));
  const severity = measurements.find((m) => /severity|damage/i.test(m.key));
  const val = parseFloat(severity?.value ?? incidence?.value ?? '');
  if (Number.isFinite(val)) {
    if (val >= 60) return 'high';
    if (val >= 30) return 'medium';
    return 'low';
  }
  if (confidence < 0.55) return 'high';
  if (confidence < 0.75) return 'medium';
  return 'low';
}

function buildEvidencePack(
  context: Awaited<ReturnType<typeof visitAiContextService.buildVisitAiContext>>,
  imageSignal: Awaited<ReturnType<typeof resolveVisitImagePredictions>>
) {
  const soilMetrics = context.soilTestSummary?.metrics as Record<string, unknown> | undefined;
  const soilKeys = soilMetrics ? Object.keys(soilMetrics).slice(0, 4) : [];
  const soilSummary = soilKeys.length
    ? soilKeys.map((k) => `${k}: ${String(soilMetrics![k])}`).join('; ')
    : 'Soil report on file';
  const weather = context.weatherSnapshot as Record<string, unknown> | null;
  return {
    photoSummary: imageSignal ? `Image signal: ${imageSignal.label}` : 'Field photos captured',
    measurementSummary: context.measurements.map((m) => `${m.key}: ${m.value}`).join(', ') || 'No measurements',
    soilSummary,
    weatherSummary: weather
      ? `Temp ${weather.temperature ?? '?'}°C, humidity ${weather.humidity ?? '?'}%`
      : 'Weather snapshot loaded',
    historySummary: 'Prior visits and recommendations loaded',
  };
}

async function detectVisitIssues(params: {
  context: Awaited<ReturnType<typeof visitAiContextService.buildVisitAiContext>>;
  imageSignal: Awaited<ReturnType<typeof resolveVisitImagePredictions>>;
  fieldVoiceNote?: string;
}): Promise<DetectedVisitIssue[]> {
  const evidence = buildEvidencePack(params.context, params.imageSignal);
  const fallback: DetectedVisitIssue = {
    category: inferIssueCategory(params.imageSignal?.label ?? 'Field observation'),
    issueName: params.imageSignal?.label ?? 'Field observation',
    confidence: params.imageSignal?.confidence ?? 0.65,
    severity: inferSeverity(params.imageSignal?.confidence ?? 0.65, params.context.measurements),
    observation: params.fieldVoiceNote,
    rootCause: {
      symptoms: params.fieldVoiceNote ? [params.fieldVoiceNote] : ['Field signs observed'],
      photoSignals: params.imageSignal ? [params.imageSignal.label] : [],
      soilSignals: evidence.soilSummary.split(';').filter(Boolean),
      weatherSignals: [evidence.weatherSummary],
      conclusion: params.imageSignal?.label ?? 'Further review recommended',
    },
    evidence,
  };

  if (!env.OPENAI_API_KEY) return [fallback];

  try {
    const prompt = `Crop: ${params.context.cropType}, DAP: ${params.context.dap ?? '?'}, Stage: ${params.context.stage ?? '?'}
Measurements: ${JSON.stringify(params.context.measurements)}
Soil: ${evidence.soilSummary}
Weather: ${evidence.weatherSummary}
Image: ${params.imageSignal?.label ?? 'none'}
Voice note: ${params.fieldVoiceNote ?? 'none'}

Return JSON {"issues":[{"issueName":"...","confidence":0.0-1.0,"severity":"low|medium|high","symptoms":["..."],"photoSignals":["..."],"soilSignals":["..."],"weatherSignals":["..."],"conclusion":"...","observation":"..."}]}
List 1-5 ranked field issues. confidence 0-1.`;

    const result = await openaiJsonCompletion<{ issues: Array<Record<string, unknown>> }>(
      'Detect multiple crop issues from field visit data.',
      prompt,
      1200
    );
    const rows = Array.isArray(result.issues) ? result.issues : [];
    if (!rows.length) return [fallback];
    const mapped: DetectedVisitIssue[] = [];
    for (const row of rows) {
      const issueName = String(row.issueName ?? '').trim();
      if (!issueName) continue;
      const confidence = clampConfidence(Number(row.confidence) || 0.65);
      mapped.push({
        category: inferIssueCategory(issueName),
        issueName,
        confidence,
        severity: (['low', 'medium', 'high'].includes(String(row.severity))
          ? String(row.severity)
          : inferSeverity(confidence, params.context.measurements)) as 'low' | 'medium' | 'high',
        observation: row.observation ? String(row.observation) : params.fieldVoiceNote,
        rootCause: {
          symptoms: Array.isArray(row.symptoms) ? row.symptoms.map(String) : [],
          photoSignals: Array.isArray(row.photoSignals) ? row.photoSignals.map(String) : [],
          soilSignals: Array.isArray(row.soilSignals) ? row.soilSignals.map(String) : [],
          weatherSignals: Array.isArray(row.weatherSignals) ? row.weatherSignals.map(String) : [],
          conclusion: String(row.conclusion ?? issueName),
        },
        evidence,
      });
    }
    return mapped.slice(0, 5);
  } catch {
    return [fallback];
  }
}

async function getLatestRecommendation(aiCaseId: string) {
  const { data } = await supabase
    .from('visit_ai_recommendations')
    .select('*')
    .eq('visit_ai_case_id', aiCaseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function recordRejectTrainingEvent(params: {
  caseRow: Record<string, unknown>;
  reason: VisitAiRejectReason;
  agronomistEmail: string;
  aiDiagnosis: string;
  aiConfidence: number | null;
  aiRecommendation: string;
  humanFinalLabel?: string;
}) {
  const { aiTrainingEventService } = await import('./ai-training-event.service.js');
  void aiTrainingEventService.record({
    farmerId: String(params.caseRow.farmer_id),
    blockId: String(params.caseRow.block_id),
    fieldFindingId: params.caseRow.field_finding_id ? String(params.caseRow.field_finding_id) : null,
    source: 'field_visit',
    reviewSurface: 'field_finding',
    aiPrediction: params.aiDiagnosis,
    aiConfidence: params.aiConfidence,
    humanAction: 'reject_recommendation',
    humanFinalLabel: params.humanFinalLabel ?? params.aiDiagnosis,
    correctionReason: params.reason,
    reviewedBy: params.agronomistEmail,
    metadata: {
      agronomistAction: 'rejected',
      rejectReason: params.reason,
      aiDiagnosis: params.aiDiagnosis,
      aiConfidence: params.aiConfidence,
      aiRecommendation: params.aiRecommendation,
    },
  });
}

async function snapshotRecommendationReject(
  recRow: Record<string, unknown> | null,
  caseRow: Record<string, unknown>,
  reason: VisitAiRejectReason
) {
  if (!recRow) return;
  const aiDiagnosis =
    (caseRow.final_diagnosis ? String(caseRow.final_diagnosis) : null) ||
    (caseRow.selected_hypothesis_label ? String(caseRow.selected_hypothesis_label) : String(caseRow.issue_name));
  await supabase
    .from('visit_ai_recommendations')
    .update({
      reject_reason: reason,
      ai_diagnosis_snapshot: aiDiagnosis,
      ai_confidence_snapshot: caseRow.final_confidence != null ? Number(caseRow.final_confidence) : null,
      ai_recommendation_snapshot: recRow.ai_text ? String(recRow.ai_text) : null,
      review_action: 'reject_recommendation',
      updated_at: new Date().toISOString(),
    })
    .eq('id', recRow.id);
}

async function getCaseOrThrow(caseId: string) {
  const { data, error } = await supabase.from('visit_ai_cases').select('*').eq('id', caseId).maybeSingle();
  throwIfSupabaseError(error, 'Could not load visit AI case');
  if (!data) throw new NotFoundError('Visit AI case not found');
  return data;
}

async function predictOutcomeWindow(
  cropType: string,
  diagnosis: string,
  defaultDays: number
): Promise<string> {
  const token = diagnosis.split(/\s+/)[0]?.slice(0, 24) ?? diagnosis.slice(0, 24);
  const { data } = await supabase
    .from('ai_learning_samples')
    .select('outcome, recommendation_snapshot')
    .eq('crop_type', cropType.toLowerCase())
    .ilike('disease_label', `%${token}%`)
    .in('outcome', ['better', 'partial'])
    .limit(40);
  const days: number[] = [];
  for (const row of data ?? []) {
    const snap = (row.recommendation_snapshot as Record<string, unknown> | null) ?? {};
    const d = Number(snap.reviewAfterDays ?? snap.review_after_days);
    if (Number.isFinite(d) && d > 0) days.push(d);
  }
  if (!days.length) return `${Math.max(3, defaultDays - 2)}–${defaultDays + 3}`;
  days.sort((a, b) => a - b);
  const mid = days[Math.floor(days.length / 2)]!;
  return `${Math.max(2, mid - 2)}–${mid + 4}`;
}

export const visitAiOrchestratorService = {
  buildContext: visitAiContextService.buildVisitAiContext.bind(visitAiContextService),

  async analyze(input: VisitAnalyzeRequest, agronomistEmail: string) {
    const context = await visitAiContextService.buildVisitAiContext(input);
    const imageSignal = await resolveVisitImagePredictions(input.analyzePhotos);
    const similarCases = await loadSimilarCases(
      input.farmerId,
      context.cropType,
      input.issueName,
      input.observation
    );
    let hypotheses = await buildHypotheses({
      context,
      issueCategory: input.issueCategory,
      issueName: input.issueName,
      observation: input.observation,
      similarCases,
    });
    hypotheses = mergeImageIntoHypotheses(hypotheses, imageSignal);

    const topConfidence = hypotheses[0]?.confidence ?? 0.5;
    const confidenceAction = resolveConfidenceAction(topConfidence);
    const skipFollowUpOptional = topConfidence >= 0.9;

    const { data: aiSession } = await supabase
      .from('ai_advisory_sessions')
      .insert({
        farmer_id: input.farmerId,
        channel: 'field_visit',
        crop_type: context.cropType,
        crop_stage: context.stage,
        language: 'en',
        symptoms_text: [input.issueName, input.observation].filter(Boolean).join(' '),
        status: 'processing',
        metadata: { visitBlockId: input.blockId, source: 'visit_ai' },
      })
      .select('id')
      .single();

    const { data: caseRow, error: caseErr } = await supabase
      .from('visit_ai_cases')
      .insert({
        session_id: input.sessionId ?? null,
        ai_advisory_session_id: aiSession?.id ?? null,
        farmer_id: input.farmerId,
        block_id: input.blockId,
        category: input.issueCategory,
        issue_name: input.issueName,
        status: 'analyzed',
        selected_hypothesis_label: input.selectedHypothesisLabel ?? hypotheses[0]?.label ?? input.issueName,
        final_confidence: topConfidence,
        confidence_action: confidenceAction,
        metadata: {
          analyzedBy: agronomistEmail,
          observation: input.observation ?? null,
          cropType: context.cropType,
          dap: context.dap,
          contextSummary: {
            dap: context.dap,
            stage: context.stage,
            measurementCount: context.measurements.length,
          },
          imageSignal: imageSignal ?? null,
          imageAiEnabled: true,
          voiceNotesEnabled: false,
          outcomePredictionEnabled: false,
        },
      })
      .select('id')
      .single();
    throwIfSupabaseError(caseErr, 'Could not create visit AI case');
    const aiCaseId = String(caseRow!.id);

    for (let i = 0; i < hypotheses.length; i++) {
      const h = hypotheses[i]!;
      await supabase.from('visit_ai_hypotheses').insert({
        visit_ai_case_id: aiCaseId,
        label: h.label,
        confidence: h.confidence,
        rationale: h.rationale ?? null,
        selected: h.label === (input.selectedHypothesisLabel ?? hypotheses[0]?.label),
        sort_order: i,
        image_prediction: h.imagePrediction ?? null,
        image_confidence: h.imageConfidence ?? null,
      });
    }

    return {
      aiCaseId,
      hypotheses: hypotheses.map((h) => ({
        label: h.label,
        confidence: h.confidence,
        rationale: h.rationale,
        selected: h.label === (input.selectedHypothesisLabel ?? hypotheses[0]?.label),
        imagePrediction: h.imagePrediction,
        imageConfidence: h.imageConfidence,
      })),
      confidenceAction,
      skipFollowUpOptional,
      imageSignal: imageSignal ? { label: imageSignal.label, confidence: imageSignal.confidence } : null,
      similarCases,
    };
  },

  async skipFollowUp(aiCaseId: string) {
    await getCaseOrThrow(aiCaseId);
    const meta = await supabase
      .from('visit_ai_cases')
      .select('metadata')
      .eq('id', aiCaseId)
      .maybeSingle();
    const metadata = (meta.data?.metadata as Record<string, unknown>) ?? {};
    await supabase
      .from('visit_ai_cases')
      .update({
        status: 'qa_complete',
        metadata: { ...metadata, qaSkipped: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', aiCaseId);
    return { skipped: true };
  },

  async getCaseDetail(aiCaseId: string) {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const [{ data: hypotheses }, { data: questions }, { data: recommendations }] = await Promise.all([
      supabase
        .from('visit_ai_hypotheses')
        .select('label, confidence, rationale, selected, image_prediction, image_confidence')
        .eq('visit_ai_case_id', aiCaseId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('visit_ai_questions')
        .select('id, question_text, answer_type, answer')
        .eq('visit_ai_case_id', aiCaseId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('visit_ai_recommendations')
        .select('ai_text, human_text, review_action, review_after_days')
        .eq('visit_ai_case_id', aiCaseId),
    ]);

    let visitedAt: string | null = null;
    if (caseRow.field_finding_id) {
      const { data: finding } = await supabase
        .from('crm_field_findings')
        .select('visited_at')
        .eq('id', caseRow.field_finding_id)
        .maybeSingle();
      visitedAt = finding?.visited_at ? String(finding.visited_at) : null;
    }

    return {
      id: String(caseRow.id),
      category: String(caseRow.category),
      issueName: String(caseRow.issue_name),
      finalDiagnosis: caseRow.final_diagnosis ? String(caseRow.final_diagnosis) : null,
      finalConfidence: caseRow.final_confidence != null ? Number(caseRow.final_confidence) : null,
      confidenceAction: caseRow.confidence_action ? String(caseRow.confidence_action) : null,
      status: String(caseRow.status),
      metadata: (caseRow.metadata as Record<string, unknown>) ?? {},
      fieldFindingId: caseRow.field_finding_id ? String(caseRow.field_finding_id) : null,
      visitedAt,
      hypotheses: (hypotheses ?? []).map((h) => ({
        label: String(h.label),
        confidence: Number(h.confidence),
        rationale: h.rationale ? String(h.rationale) : undefined,
        selected: Boolean(h.selected),
        imagePrediction: h.image_prediction ? String(h.image_prediction) : undefined,
        imageConfidence: h.image_confidence != null ? Number(h.image_confidence) : undefined,
      })),
      questions: (questions ?? []).map((q) => ({
        id: String(q.id),
        questionText: String(q.question_text),
        answerType: String(q.answer_type) as 'yes_no_unknown' | 'text' | 'number',
        answer: q.answer ? String(q.answer) : undefined,
      })),
      recommendations: (recommendations ?? []).map((r) => ({
        aiText: String(r.ai_text ?? ''),
        humanText: r.human_text ? String(r.human_text) : null,
        reviewAction: r.review_action ? String(r.review_action) : null,
        reviewAfterDays: r.review_after_days != null ? Number(r.review_after_days) : null,
      })),
    };
  },

  async getQuestions(aiCaseId: string) {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const { data: existing } = await supabase
      .from('visit_ai_questions')
      .select('*')
      .eq('visit_ai_case_id', aiCaseId)
      .order('sort_order', { ascending: true });

    if (existing?.length) {
      return existing.map((q) => ({
        id: String(q.id),
        questionText: String(q.question_text),
        answerType: String(q.answer_type) as 'yes_no_unknown' | 'text' | 'number',
        answer: q.answer ? String(q.answer) : undefined,
      }));
    }

    const diagnosis =
      caseRow.selected_hypothesis_label ? String(caseRow.selected_hypothesis_label) : String(caseRow.issue_name);
    const meta = (caseRow.metadata as Record<string, unknown>) ?? {};
    if (meta.qaSkipped) {
      return [];
    }
    const context = await visitAiContextService.buildVisitAiContext({
      farmerId: String(caseRow.farmer_id),
      blockId: String(caseRow.block_id),
      sessionId: caseRow.session_id ? String(caseRow.session_id) : undefined,
    });

    const drafts = await visitAiQuestionsService.buildVisitFollowUpQuestions({
      farmerId: String(caseRow.farmer_id),
      cropType: context.cropType,
      issueCategory: String(caseRow.category),
      selectedHypothesis: diagnosis,
      observation: meta.observation as string | undefined,
      context,
    });

    const rows: Array<{ id: string; questionText: string; answerType: 'yes_no_unknown' | 'text' | 'number' }> = [];
    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i]!;
      if (draft.sourceLibraryId) {
        void expertFollowUpLearningService.recordHit(draft.sourceLibraryId).catch(() => {});
      }
      const { data: qRow, error } = await supabase
        .from('visit_ai_questions')
        .insert({
          visit_ai_case_id: aiCaseId,
          question_text: draft.questionText,
          answer_type: draft.answerType,
          sort_order: i,
          source_library_id: draft.sourceLibraryId ?? null,
          metadata: draft.kind ? { kind: draft.kind } : {},
        })
        .select('id, question_text, answer_type')
        .single();
      throwIfSupabaseError(error, 'Could not save follow-up question');
      rows.push({
        id: String(qRow!.id),
        questionText: String(qRow!.question_text),
        answerType: draft.answerType,
      });
    }

    await supabase
      .from('visit_ai_cases')
      .update({ status: 'qa_complete', updated_at: new Date().toISOString() })
      .eq('id', aiCaseId);

    return rows;
  },

  async saveAnswers(aiCaseId: string, body: VisitAiAnswersBody) {
    await getCaseOrThrow(aiCaseId);
    for (const ans of body.answers) {
      await supabase
        .from('visit_ai_questions')
        .update({
          answer: ans.answer,
          answered_at: new Date().toISOString(),
        })
        .eq('id', ans.questionId)
        .eq('visit_ai_case_id', aiCaseId);
    }
    return { saved: body.answers.length };
  },

  async reanalyze(aiCaseId: string) {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const { data: answers } = await supabase
      .from('visit_ai_questions')
      .select('question_text, answer')
      .eq('visit_ai_case_id', aiCaseId)
      .not('answer', 'is', null);

    const context = await visitAiContextService.buildVisitAiContext({
      farmerId: String(caseRow.farmer_id),
      blockId: String(caseRow.block_id),
      sessionId: caseRow.session_id ? String(caseRow.session_id) : undefined,
    });

    const answerSummary = (answers ?? [])
      .map((a) => `${a.question_text}: ${a.answer}`)
      .join('; ');
    const similarCases = await loadSimilarCases(
      String(caseRow.farmer_id),
      context.cropType,
      String(caseRow.issue_name),
      answerSummary
    );
    const hypotheses = await buildHypotheses({
      context,
      issueCategory: String(caseRow.category),
      issueName: String(caseRow.selected_hypothesis_label ?? caseRow.issue_name),
      observation: answerSummary,
      similarCases,
    });

    await supabase.from('visit_ai_hypotheses').delete().eq('visit_ai_case_id', aiCaseId);
    for (let i = 0; i < hypotheses.length; i++) {
      const h = hypotheses[i]!;
      await supabase.from('visit_ai_hypotheses').insert({
        visit_ai_case_id: aiCaseId,
        label: h.label,
        confidence: h.confidence,
        rationale: h.rationale ?? null,
        selected: i === 0,
        sort_order: i,
      });
    }

    const topConfidence = hypotheses[0]?.confidence ?? 0.5;
    const finalDiagnosis = hypotheses[0]?.label ?? String(caseRow.issue_name);
    const confidenceAction = resolveConfidenceAction(topConfidence);

    await supabase
      .from('visit_ai_cases')
      .update({
        selected_hypothesis_label: finalDiagnosis,
        final_diagnosis: finalDiagnosis,
        final_confidence: topConfidence,
        confidence_action: confidenceAction,
        status: 'qa_complete',
        updated_at: new Date().toISOString(),
      })
      .eq('id', aiCaseId);

    return {
      finalDiagnosis,
      finalConfidence: topConfidence,
      confidenceAction,
      hypotheses,
    };
  },

  async recommend(aiCaseId: string, finalDiagnosis?: string) {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const diagnosis =
      finalDiagnosis?.trim() ||
      (caseRow.final_diagnosis ? String(caseRow.final_diagnosis) : null) ||
      (caseRow.selected_hypothesis_label ? String(caseRow.selected_hypothesis_label) : String(caseRow.issue_name));

    const context = await visitAiContextService.buildVisitAiContext({
      farmerId: String(caseRow.farmer_id),
      blockId: String(caseRow.block_id),
      sessionId: caseRow.session_id ? String(caseRow.session_id) : undefined,
    });

    let aiText = `Monitor ${diagnosis} on ${context.cropType}. Apply recommended crop protection as per label rates. Re-check in 7 days.`;
    let dosage: string | null = null;
    let priority: 'normal' | 'high' | 'critical' = 'normal';
    let reviewAfterDays = 7;

    const { data: template } = await supabase
      .from('recommendation_templates')
      .select('recommendation_text_en, dosage_en, priority, review_after_days')
      .eq('crop_type', context.cropType)
      .ilike('issue_label_en', `%${diagnosis.split(' ')[0]}%`)
      .neq('status', 'archived')
      .limit(1)
      .maybeSingle();

    if (template) {
      aiText = String(template.recommendation_text_en ?? aiText);
      dosage = template.dosage_en ? String(template.dosage_en) : null;
      priority = (template.priority as typeof priority) ?? 'normal';
      reviewAfterDays = template.review_after_days != null ? Number(template.review_after_days) : 7;
    } else if (env.OPENAI_API_KEY) {
      try {
        const result = await openaiJsonCompletion<{
          text: string;
          dosage?: string;
          priority?: string;
          reviewAfterDays?: number;
        }>(
          'Return JSON with recommendation text, optional dosage, priority (normal|high|critical), reviewAfterDays.',
          `Crop: ${context.cropType}, DAP: ${context.dap}, Diagnosis: ${diagnosis}, Severity category: ${caseRow.category}`,
          600
        );
        if (result.text?.trim()) aiText = result.text.trim();
        dosage = result.dosage?.trim() ?? null;
        if (result.priority === 'high' || result.priority === 'critical') priority = result.priority;
        if (result.reviewAfterDays) reviewAfterDays = result.reviewAfterDays;
      } catch {
        // keep fallback
      }
    }

    const reviewDate = new Date(Date.now() + reviewAfterDays * 86400000);
    const expectedImprovementDays = await predictOutcomeWindow(context.cropType, diagnosis, reviewAfterDays);

    const { data: recRow, error } = await supabase
      .from('visit_ai_recommendations')
      .insert({
        visit_ai_case_id: aiCaseId,
        ai_text: aiText,
        dosage,
        priority,
        review_after_days: reviewAfterDays,
        review_date: reviewDate.toISOString(),
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not save AI recommendation draft');

    await supabase
      .from('visit_ai_cases')
      .update({
        final_diagnosis: diagnosis,
        status: 'recommended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', aiCaseId);

    return {
      recommendationId: String(recRow!.id),
      text: aiText,
      dosage,
      priority,
      reviewAfterDays,
      reviewDate: reviewDate.toISOString(),
      expectedImprovementDays,
    };
  },

  async analyzeVisit(input: VisitAnalyzeVisitRequest, agronomistEmail: string) {
    const context = await visitAiContextService.buildVisitAiContext(input);
    const analyzePhotos = input.analyzePhotos?.map((p) => ({
      dataBase64: p.dataBase64,
      mimeType: p.mimeType,
    }));
    const imageSignal = await resolveVisitImagePredictions(analyzePhotos);
    const detected = await detectVisitIssues({
      context,
      imageSignal,
      fieldVoiceNote: input.fieldVoiceNote,
    });

    const issues = [];
    for (const det of detected) {
      const analyzed = await this.analyze(
        {
          ...input,
          issueCategory: det.category as VisitAnalyzeRequest['issueCategory'],
          issueName: det.issueName,
          observation: det.observation,
          analyzePhotos: analyzePhotos?.slice(0, 4),
        },
        agronomistEmail
      );
      const top = analyzed.hypotheses.find((h) => h.selected) ?? analyzed.hypotheses[0];
      const rec = await this.recommend(analyzed.aiCaseId, top?.label ?? det.issueName);
      issues.push({
        localId: `ai-${analyzed.aiCaseId}`,
        category: det.category,
        issueName: det.issueName,
        confidence: det.confidence,
        aiConfidence: det.confidence,
        severity: det.severity,
        observation: det.observation ?? '',
        aiCaseId: analyzed.aiCaseId,
        hypotheses: analyzed.hypotheses,
        selectedHypothesisLabel: top?.label,
        finalDiagnosis: top?.label ?? det.issueName,
        finalRecommendation: rec.text,
        confidenceAction: analyzed.confidenceAction,
        skipFollowUpOptional: analyzed.skipFollowUpOptional,
        imageSignal: analyzed.imageSignal ?? undefined,
        similarCases: analyzed.similarCases,
        rootCause: det.rootCause,
        evidence: det.evidence,
        initialRecommendation: {
          text: rec.text,
          dose: rec.dosage ?? undefined,
          method: rec.priority === 'critical' ? 'Spray (urgent)' : 'Spray',
          category: det.category,
        },
      });
    }

    return { issues };
  },

  async similarCases(farmerId: string, cropType: string, issueName: string) {
    return loadSimilarCases(farmerId, cropType, issueName);
  },

  async searchCaseLibrary(params: {
    cropType?: string;
    issue?: string;
    outcome?: string;
    dapBucket?: string;
    severity?: string;
    reviewAction?: string;
    limit?: number;
  }) {
    let q = supabase
      .from('visit_ai_cases')
      .select(
        `id, category, issue_name, final_diagnosis, final_confidence, status, created_at, metadata,
         visit_ai_recommendations(review_action, human_text),
         crm_field_findings(id, visited_at, block_id, visit_issues(severity))`
      )
      .eq('status', 'submitted')
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 50);

    if (params.cropType) {
      q = q.contains('metadata', { cropType: params.cropType });
    }

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not search case library');

    let rows = data ?? [];
    if (params.issue) {
      const needle = params.issue.toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.issue_name).toLowerCase().includes(needle) ||
          String(r.final_diagnosis ?? '').toLowerCase().includes(needle)
      );
    }
    if (params.dapBucket) {
      const bucket = params.dapBucket.toLowerCase();
      rows = rows.filter((r) => {
        const meta = (r.metadata as Record<string, unknown>) ?? {};
        const dap = meta.dap != null ? buildDapBucket(Number(meta.dap)) : null;
        return String(dap ?? '') === bucket || String(meta.dapBucket ?? '').toLowerCase() === bucket;
      });
    }
    if (params.severity) {
      const sev = params.severity.toLowerCase();
      rows = rows.filter((r) => {
        const issues = (r.crm_field_findings as { visit_issues?: Array<{ severity?: string }> } | null)
          ?.visit_issues;
        return issues?.some((vi) => String(vi.severity ?? '').toLowerCase() === sev);
      });
    }
    if (params.reviewAction) {
      const action = params.reviewAction.toLowerCase();
      rows = rows.filter((r) => {
        const recs = r.visit_ai_recommendations as Array<{ review_action?: string }> | null;
        return recs?.some((rec) => String(rec.review_action ?? '').toLowerCase() === action);
      });
    }
    if (params.outcome) {
      const outcome = params.outcome.toLowerCase();
      rows = rows.filter((r) => {
        const meta = (r.metadata as Record<string, unknown>) ?? {};
        return String(meta.outcome ?? '').toLowerCase() === outcome;
      });
    }

    return rows.map((r) => {
      const meta = (r.metadata as Record<string, unknown>) ?? {};
      const finding = r.crm_field_findings as {
        visited_at?: string;
        id?: string;
        visit_issues?: Array<{ severity?: string }>;
      } | null;
      return {
        id: String(r.id),
        category: String(r.category),
        issueName: String(r.issue_name),
        finalDiagnosis: r.final_diagnosis ? String(r.final_diagnosis) : null,
        confidence: r.final_confidence != null ? Number(r.final_confidence) : null,
        visitedAt: finding?.visited_at ?? String(r.created_at),
        reviewAction:
          (r.visit_ai_recommendations as Array<{ review_action?: string }> | null)?.[0]?.review_action ?? null,
        fieldFindingId: finding?.id ? String(finding.id) : null,
        dap: meta.dap != null ? Number(meta.dap) : null,
        dapBucket: meta.dap != null ? buildDapBucket(Number(meta.dap)) : null,
        severity: finding?.visit_issues?.[0]?.severity ?? null,
        outcome: meta.outcome ? String(meta.outcome) : null,
        cropType: meta.cropType ? String(meta.cropType) : null,
      };
    });
  },

  mapReviewToTrainingAction(action: ReviewAction): ReviewAction {
    return action;
  },

  async rejectRecommendation(aiCaseId: string, body: VisitAiRejectBody, agronomistEmail: string) {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const recRow = await getLatestRecommendation(aiCaseId);
    const aiDiagnosis =
      (caseRow.final_diagnosis ? String(caseRow.final_diagnosis) : null) ||
      (caseRow.selected_hypothesis_label ? String(caseRow.selected_hypothesis_label) : String(caseRow.issue_name));
    const aiRecommendation = recRow?.ai_text ? String(recRow.ai_text) : '';
    const aiConfidence = caseRow.final_confidence != null ? Number(caseRow.final_confidence) : null;

    await snapshotRecommendationReject(recRow, caseRow, body.reason);
    await recordRejectTrainingEvent({
      caseRow,
      reason: body.reason,
      agronomistEmail,
      aiDiagnosis,
      aiConfidence,
      aiRecommendation,
      humanFinalLabel: body.correctedDiagnosis ?? body.editedRecommendation ?? aiDiagnosis,
    });

    if (body.reason === 'wrong_diagnosis') {
      const corrected = body.correctedDiagnosis!.trim();
      await supabase
        .from('visit_ai_cases')
        .update({
          final_diagnosis: corrected,
          selected_hypothesis_label: corrected,
          status: 'diagnosis_confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', aiCaseId);
      const rec = await this.recommend(aiCaseId, corrected);
      if (recRow) {
        await supabase
          .from('visit_ai_recommendations')
          .update({
            human_text: rec.text,
            modification_reason: `Wrong diagnosis corrected to: ${corrected}`,
            review_action: 'correct_ai',
            updated_at: new Date().toISOString(),
          })
          .eq('id', recRow.id);
      }
      return {
        status: 'diagnosis_confirmed' as const,
        finalDiagnosis: corrected,
        finalRecommendation: rec.text,
        dosage: rec.dosage,
        reviewAfterDays: rec.reviewAfterDays,
        reviewAction: 'correct_ai' as const,
      };
    }

    if (body.reason === 'need_more_evidence') {
      const { recommendationCommunicationService } = await import(
        './recommendation-communication.service.js'
      );
      const sendResult = await recommendationCommunicationService.sendEvidenceRequest({
        farmerId: String(caseRow.farmer_id),
        blockId: String(caseRow.block_id),
        diagnosis: aiDiagnosis,
        photoTypes: body.evidenceRequest!.photoTypes,
        questions: body.evidenceRequest!.questions,
      });
      await supabase.from('visit_ai_evidence_requests').insert({
        visit_ai_case_id: aiCaseId,
        photo_types: body.evidenceRequest!.photoTypes,
        questions: body.evidenceRequest!.questions,
        whatsapp_message_id: sendResult.messageId ?? null,
        status: sendResult.sent ? 'sent' : 'pending',
        sent_at: sendResult.sent ? new Date().toISOString() : null,
      });
      await supabase
        .from('visit_ai_cases')
        .update({
          status: 'waiting_farmer_response',
          updated_at: new Date().toISOString(),
        })
        .eq('id', aiCaseId);
      return {
        status: 'waiting_farmer_response' as const,
        whatsappSent: sendResult.sent,
        reviewAction: 'reject_recommendation' as const,
      };
    }

    if (body.reason === 'recommendation_not_suitable') {
      const edited = body.editedRecommendation!.trim();
      await supabase
        .from('visit_ai_cases')
        .update({
          status: 'recommendation_confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', aiCaseId);
      if (recRow) {
        await supabase
          .from('visit_ai_recommendations')
          .update({
            human_text: edited,
            modification_reason: body.rejectNote ?? 'Recommendation not suitable',
            review_action: 'partial_match',
            updated_at: new Date().toISOString(),
          })
          .eq('id', recRow.id);
      }
      return {
        status: 'recommendation_confirmed' as const,
        finalRecommendation: edited,
        reviewAction: 'partial_match' as const,
      };
    }

    const custom = body.customRecommendation!;
    const customText = [
      custom.product.trim(),
      `Dose: ${custom.dose.trim()}`,
      `Method: ${custom.method.trim()}`,
      custom.reviewDate ? `Review date: ${custom.reviewDate}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    await supabase
      .from('visit_ai_cases')
      .update({
        status: 'recommendation_confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', aiCaseId);
    if (recRow) {
      await supabase
        .from('visit_ai_recommendations')
        .update({
          human_text: customText,
          dosage: custom.dose.trim(),
          modification_reason: `Custom recommendation: ${custom.product.trim()}`,
          review_action: 'correct_ai',
          updated_at: new Date().toISOString(),
        })
        .eq('id', recRow.id);
    }
    return {
      status: 'recommendation_confirmed' as const,
      finalRecommendation: customText,
      dosage: custom.dose.trim(),
      reviewAction: 'correct_ai' as const,
      customRecommendation: custom,
    };
  },

  async linkCaseToVisitIssue(aiCaseId: string, fieldFindingId: string, visitIssueId: string) {
    const caseRow = await getCaseOrThrow(aiCaseId);
    const keepStatus =
      String(caseRow.status) === 'waiting_farmer_response' ||
      String(caseRow.status) === 'need_more_evidence';
    await supabase
      .from('visit_ai_cases')
      .update({
        field_finding_id: fieldFindingId,
        visit_issue_id: visitIssueId,
        ...(keepStatus ? {} : { status: 'submitted' }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', aiCaseId);
  },
};
