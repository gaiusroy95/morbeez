import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { supabase } from '../../../lib/supabase.js';
import type { AdvisoryLanguage, StructuredAdvisory } from '../../ai/types.js';
import { aiReuseService, buildDapBucket } from '../../ai/ai-reuse.service.js';
import { normalizeRegionalFarmerQuery } from '../../ai/regional-query-normalize.util.js';
import { buildQuestionReuseKeys } from '../../ai/question-reuse-keys.util.js';
import { buildCrossLanguageIntentSlug } from './crop-message-intent.service.js';
import { blockService } from '../../core/block.service.js';
import { inputClassifierService } from './input-classifier.service.js';
import { conversationSessionService } from '../conversation-session.service.js';
import type { SessionContext } from '../scenarios/session-context.types.js';
import { whatsappService } from '../whatsapp.service.js';
import { contextPackService } from './context-pack.service.js';
import { farmerMemoryService } from './farmer-memory.service.js';
import { nearbyCasesService } from './nearby-cases.service.js';
import {
  diagnosisFollowUpReasoningEngine,
  type InvestigationContext,
  type PostIntakeDiagnosisPayload,
} from './diagnosis-follow-up-reasoning.engine.js';
import {
  diagnosisFollowUpQuestionGenerator,
  type FollowUpQuestionKind,
  type LearnedInvestigationPattern,
} from './diagnosis-follow-up-question.generator.js';
import { expertFollowUpLearningService } from '../../core/expert-follow-up-learning.service.js';
import { cropPackLoaderService } from '../../crop-pack/crop-pack-loader.service.js';
import type { MaiosCase } from '../../../domain/case/types.js';
import { sendReplyButtonMenu } from '../whatsapp-interactive-menu.service.js';
import { getReviewThreshold } from '../../../domain/ai-training/confidence-routing.js';
import {
  localizeChoice,
  YES_NO_CHOICES,
  type FollowUpChoiceOption,
} from './follow-up-question.types.js';

const MAX_QUESTIONS = () => Number(process.env.DIAGNOSIS_FOLLOW_UP_MAX_QUESTIONS ?? 3);
const MAX_POST_DIAGNOSIS_QUESTIONS = () =>
  Number(process.env.DIAGNOSIS_POST_FOLLOW_UP_MAX_QUESTIONS ?? 3);
const MIN_SIMILAR_CASES = () => Number(process.env.DIAGNOSIS_FOLLOW_UP_MIN_CASES ?? 1);
const STRONG_MATCH_SCORE = () => Number(process.env.DIAGNOSIS_FOLLOW_UP_STRONG_MATCH ?? 0.9);

export type SimilarLearnedCase = {
  reuseCaseId: string;
  issueLabel: string;
  symptomKey: string;
  score: number;
  hitCount: number;
  confidence: number;
  staffVerified: boolean;
};

export type FollowUpQuestion = {
  id: string;
  kind: FollowUpQuestionKind;
  text: string;
  choices: FollowUpChoiceOption[];
  purpose?: string;
  libraryId?: string;
  fromExpertLibrary?: boolean;
};

type IntakeContext = NonNullable<SessionContext['diagnosisIntake']>;
type PostDiagnosisIntakeContext = NonNullable<SessionContext['postDiagnosisIntake']>;

function toAdvisorySnapshot(advisory: StructuredAdvisory): PostDiagnosisIntakeContext['advisorySnapshot'] {
  return {
    probableIssue: advisory.probableIssue,
    confidence: advisory.confidence,
    uncertain: advisory.uncertain,
    imageObservations: advisory.imageObservations,
    stressAnalysis: advisory.stressAnalysis,
    differentialDiagnosis: advisory.differentialDiagnosis,
    rejectedHypotheses: advisory.rejectedHypotheses,
  };
}

function attachPostQuestionToIntake(intake: PostDiagnosisIntakeContext, q: FollowUpQuestion): void {
  intake.questionTexts = intake.questionTexts ?? {};
  intake.questionKinds = intake.questionKinds ?? {};
  intake.questionChoices = intake.questionChoices ?? {};
  intake.questionTexts[q.id] = q.text;
  intake.questionKinds[q.id] = q.kind;
  intake.questionChoices[q.id] = q.choices;
}

function choiceButtonId(optionId: string, questionId: string): string {
  if (optionId === 'yes' || optionId === 'no') return `dfq.${optionId}.${questionId}`;
  return `dfq.choice.${optionId}.${questionId}`;
}

function attachQuestionToIntake(intake: IntakeContext, q: FollowUpQuestion): void {
  intake.questionTexts = intake.questionTexts ?? {};
  intake.questionKinds = intake.questionKinds ?? {};
  intake.questionChoices = intake.questionChoices ?? {};
  intake.questionTexts[q.id] = q.text;
  intake.questionKinds[q.id] = q.kind;
  intake.questionChoices[q.id] = q.choices;
}

function looksLikeSymptomDescription(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 6) return false;
  if (/^(yes|no|y|n|skip|1|2)$/i.test(t)) return false;
  if (t.startsWith('dfq.') || t.startsWith('menu.') || t.startsWith('lang.')) return false;
  return true;
}

function farmerSentCropEvidence(params: { text: string; hasPhoto: boolean }): boolean {
  return params.hasPhoto || looksLikeSymptomDescription(params.text);
}

async function abandonDiagnosisIntake(farmerId: string): Promise<void> {
  await conversationSessionService.patchContext(farmerId, { diagnosisIntake: undefined });
  await conversationSessionService.setState(farmerId, 'diagnosis');
}

function intakeAnswerHint(language: AdvisoryLanguage): string {
  return language === 'ml'
    ? 'ദയവായി ചോദ്യത്തിന് മറുപടി നൽകൂ (അല്ലെങ്കിൽ Yes / No ടൈപ്പ് ചെയ്യൂ):'
    : 'Please answer the question below (or type Yes / No):';
}

async function sendStructuredChoices(params: {
  phone: string;
  language: AdvisoryLanguage;
  body: string;
  questionId: string;
  choices: FollowUpChoiceOption[];
}): Promise<void> {
  const buttons = params.choices.map((c) => ({
    id: choiceButtonId(c.id, params.questionId),
    title: localizeChoice(c, params.language),
  }));

  if (buttons.length <= 3) {
    await whatsappService.sendButtons({
      to: params.phone,
      body: params.body,
      buttons,
    });
    return;
  }

  await sendReplyButtonMenu({
    to: params.phone,
    body: params.body,
    options: buttons,
    continuationBody:
      params.language === 'ml'
        ? 'കൂടുതൽ选项 — താഴെ ബട്ടൺ തിരഞ്ഞെടുക്കൂ:'
        : 'More options — tap a button below:',
    sendButtons: (p) => whatsappService.sendButtons(p),
  });
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );
}

function overlapScore(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) {
    if (sb.has(t)) inter += 1;
  }
  return inter / Math.max(sa.size, sb.size);
}

function slugOverlap(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const pa = a.split('_').filter(Boolean);
  const pb = b.split('_').filter(Boolean);
  if (!pa.length || !pb.length) return 0;
  const pbSet = new Set(pb);
  let shared = 0;
  for (const p of pa) {
    if (pbSet.has(p)) shared += 1;
  }
  return shared / Math.max(pa.length, pb.length);
}

function scoreLearnedCaseMatch(params: {
  cropType: string;
  symptomsText: string;
  issueLabel: string;
  symptomKey: string;
}): number {
  const normalizedFarmer = normalizeRegionalFarmerQuery(params.symptomsText);
  const farmerSlug = buildCrossLanguageIntentSlug(params.cropType, normalizedFarmer);
  const caseSlug = buildCrossLanguageIntentSlug(
    params.cropType,
    normalizeRegionalFarmerQuery(params.issueLabel),
    params.issueLabel
  );

  const farmerKeys = new Set(
    buildQuestionReuseKeys({
      text: params.symptomsText,
      intentSlug: farmerSlug,
    })
  );
  if (farmerKeys.has(params.symptomKey)) return 0.96;

  const slugScore = slugOverlap(farmerSlug, caseSlug);
  const textScore = overlapScore(
    normalizedFarmer,
    `${params.issueLabel} ${normalizeRegionalFarmerQuery(params.issueLabel)}`
  );

  return Math.max(slugScore * 0.92, textScore);
}

async function countVerifiedCasesForCrop(cropType: string): Promise<number> {
  const { count } = await supabase
    .from('advisory_reuse_cases')
    .select('id', { count: 'exact', head: true })
    .eq('crop_type', cropType.toLowerCase())
    .eq('outcome_ok', true);
  return count ?? 0;
}

type AdvisorySnapshotExtended = {
  staffVerified?: boolean;
  investigationPatterns?: LearnedInvestigationPattern[];
  investigationPattern?: LearnedInvestigationPattern;
};

function patternsFromSnapshot(snap: AdvisorySnapshotExtended | null): LearnedInvestigationPattern[] {
  if (!snap) return [];
  if (Array.isArray(snap.investigationPatterns) && snap.investigationPatterns.length) {
    return snap.investigationPatterns.filter((p) => p.qa?.length);
  }
  if (snap.investigationPattern?.qa?.length) return [snap.investigationPattern];
  return [];
}

async function loadLearnedInvestigationPatterns(
  reuseCaseIds: string[]
): Promise<LearnedInvestigationPattern[]> {
  const ids = [...new Set(reuseCaseIds.filter(Boolean))].slice(0, 12);
  if (!ids.length) return [];

  const { data: rows } = await supabase
    .from('advisory_reuse_cases')
    .select('id, issue_label, advisory_snapshot')
    .in('id', ids);

  const patterns: LearnedInvestigationPattern[] = [];
  for (const row of rows ?? []) {
    const snap = row.advisory_snapshot as AdvisorySnapshotExtended | null;
    for (const p of patternsFromSnapshot(snap)) {
      patterns.push({
        ...p,
        issueLabel: p.issueLabel || String(row.issue_label ?? ''),
      });
    }
  }
  return patterns;
}

export const diagnosisFollowUpService = {
  enabled(): boolean {
    return env.ENABLE_DIAGNOSIS_FOLLOW_UP !== false && env.ENABLE_AI_REUSE_CACHE !== false;
  },

  async findSimilarLearnedCases(params: {
    cropType: string;
    district: string | null;
    symptomsText: string;
    limit?: number;
  }): Promise<SimilarLearnedCase[]> {
    const crop = params.cropType.toLowerCase();
    const district = params.district?.toLowerCase() ?? '';
    const limit = params.limit ?? 25;

    const { data: rows } = await supabase
      .from('advisory_reuse_cases')
      .select('id, issue_label, symptom_key, confidence_score, hit_count, advisory_snapshot, district')
      .eq('crop_type', crop)
      .eq('outcome_ok', true)
      .gte('confidence_score', 0.65)
      .order('hit_count', { ascending: false })
      .limit(80);

    const normalizedFarmer = normalizeRegionalFarmerQuery(params.symptomsText);
    const farmerSlug = buildCrossLanguageIntentSlug(crop, normalizedFarmer);

    const scored: SimilarLearnedCase[] = [];
    const rowCount = rows?.length ?? 0;
    for (const row of rows ?? []) {
      const issueLabel = String(row.issue_label ?? '').trim();
      const symptomKey = String(row.symptom_key ?? '');
      const snap = row.advisory_snapshot as { staffVerified?: boolean } | null;
      const score = scoreLearnedCaseMatch({
        cropType: crop,
        symptomsText: params.symptomsText,
        issueLabel,
        symptomKey,
      });
      const districtBoost =
        district && String(row.district ?? '') === district ? 0.08 : 0;
      const finalScore = Math.min(1, score + districtBoost + Math.min(0.12, (row.hit_count ?? 0) / 200));

      if (finalScore < 0.15) continue;

      scored.push({
        reuseCaseId: String(row.id),
        issueLabel,
        symptomKey,
        score: finalScore,
        hitCount: Number(row.hit_count ?? 0),
        confidence: Number(row.confidence_score ?? 0.7),
        staffVerified: Boolean(snap?.staffVerified),
      });
    }

    if (scored.length < MIN_SIMILAR_CASES() && rowCount >= MIN_SIMILAR_CASES() && farmerSlug) {
      for (const row of rows ?? []) {
        const issueLabel = String(row.issue_label ?? '').trim();
        const symptomKey = String(row.symptom_key ?? '');
        if (scored.some((s) => s.reuseCaseId === String(row.id))) continue;
        const caseSlug = buildCrossLanguageIntentSlug(
          crop,
          normalizeRegionalFarmerQuery(issueLabel),
          issueLabel
        );
        if (slugOverlap(farmerSlug, caseSlug) < 0.3) continue;
        const snap = row.advisory_snapshot as { staffVerified?: boolean } | null;
        scored.push({
          reuseCaseId: String(row.id),
          issueLabel,
          symptomKey,
          score: 0.45,
          hitCount: Number(row.hit_count ?? 0),
          confidence: Number(row.confidence_score ?? 0.7),
          staffVerified: Boolean(snap?.staffVerified),
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const result = scored.slice(0, limit);
    logger.info(
      {
        crop,
        farmerSlug,
        rowCount,
        matched: result.length,
        topScore: result[0]?.score,
        topIssue: result[0]?.issueLabel?.slice(0, 80),
      },
      'Diagnosis follow-up similar-case search'
    );
    return result;
  },

  async buildInvestigationContext(params: {
    farmerId: string;
    language: AdvisoryLanguage;
    symptomsText: string;
    cropType: string;
    hasPhoto: boolean;
  }): Promise<InvestigationContext> {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('district')
      .eq('id', params.farmerId)
      .maybeSingle();
    const district = farmer?.district ? String(farmer.district).trim().toLowerCase() : null;

    const memory = await farmerMemoryService.build(params.farmerId, {
      symptomsText: params.symptomsText,
    });
    const contextPack = await contextPackService.build(params.farmerId, {
      cropType: params.cropType,
      symptomsText: params.symptomsText,
      dap: memory.dap,
      blockId: memory.activePlotId,
    });
    const nearby = await nearbyCasesService.summarize(params.farmerId, params.cropType);
    const similar = await this.findSimilarLearnedCases({
      cropType: params.cropType,
      district,
      symptomsText: params.symptomsText,
    });
    const totalVerified = Math.max(
      nearby.verifiedReuseHits,
      await countVerifiedCasesForCrop(params.cropType)
    );
    const classified = inputClassifierService.classifyText(params.symptomsText);
    const best = similar[0];
    const learnedPatterns = await loadLearnedInvestigationPatterns(
      similar.slice(0, 8).map((c) => c.reuseCaseId)
    );

    return {
      language: params.language,
      cropType: params.cropType,
      symptomsText: params.symptomsText,
      hasPhoto: params.hasPhoto,
      dap: memory.dap,
      similarCases: similar,
      totalVerifiedCases: totalVerified,
      matchConfidence: best?.score ?? 0,
      bestIssueLabel: best?.issueLabel,
      heavyRainLikely: contextPack.heavyRainLikely,
      highHumidityLikely: contextPack.highHumidityLikely,
      highHeatLikely: contextPack.highHeatLikely,
      weatherRiskScore: contextPack.weatherRiskScore,
      diseasePriors: contextPack.diseasePriors,
      lastSprayKnown: Boolean(memory.lastSpray?.trim()),
      category: classified.category,
      learnedPatterns,
    };
  },

  async deriveEvidenceGaps(farmerId: string): Promise<string[]> {
    const ctx = await conversationSessionService.getContext(farmerId);
    const maiosCase = ctx.maiosCase as MaiosCase | undefined;
    if (!maiosCase?.evidence?.photos?.length) return [];

    const pack = await cropPackLoaderService.load(maiosCase.identity.cropType);
    const captured = maiosCase.evidence.photos
      .filter((p) => p.status === 'captured')
      .map((p) => p.slot);
    const missing = cropPackLoaderService.nextMissingSlots(pack, captured, 5);
    return missing.map((s) => s.labelEn || s.id);
  },

  async planNextQuestionForIntake(
    investigation: InvestigationContext,
    intake: IntakeContext,
    opts?: { evidenceGaps?: string[]; farmerId?: string }
  ): Promise<{ intakeComplete: boolean; question?: FollowUpQuestion }> {
    const maxQuestions = intake.maxQuestions ?? MAX_QUESTIONS();
    const questionsAsked = intake.questionsAsked ?? Object.keys(intake.answers).length;

    if (questionsAsked >= maxQuestions) {
      return { intakeComplete: true };
    }

    const pending = intake.pendingSavedQuestions ?? [];
    while (pending.length) {
      const saved = pending[0];
      if (intake.answers[saved.id] !== undefined) {
        pending.shift();
        continue;
      }
      pending.shift();
      intake.pendingSavedQuestions = pending;
      if (saved.libraryId) {
        void expertFollowUpLearningService.recordHit(saved.libraryId);
      }
      return { intakeComplete: false, question: saved };
    }

    const evidenceGaps =
      opts?.evidenceGaps ??
      (opts?.farmerId ? await this.deriveEvidenceGaps(opts.farmerId) : []);

    const result = await diagnosisFollowUpQuestionGenerator.planNextQuestion({
      ctx: investigation,
      priorAnswers: intake.answers as Record<string, string>,
      questionTexts: intake.questionTexts ?? {},
      questionsAsked,
      maxQuestions,
      learnedPatterns: investigation.learnedPatterns,
      evidenceGaps,
    });

    if (result.intakeComplete || !result.question) {
      return { intakeComplete: true };
    }

    return {
      intakeComplete: false,
      question: {
        id: result.question.id,
        kind: result.question.kind,
        text: result.question.text,
        choices: result.question.choices,
        purpose: result.question.purpose,
        fromExpertLibrary: false,
      },
    };
  },

  async planNextPostDiagnosisQuestion(
    investigation: InvestigationContext,
    intake: PostDiagnosisIntakeContext
  ): Promise<{ intakeComplete: boolean; question?: FollowUpQuestion }> {
    const maxQuestions = intake.maxQuestions ?? MAX_POST_DIAGNOSIS_QUESTIONS();
    const questionsAsked = intake.questionsAsked ?? Object.keys(intake.answers).length;

    if (questionsAsked >= maxQuestions) {
      return { intakeComplete: true };
    }

    const result = await diagnosisFollowUpQuestionGenerator.planPostDiagnosisQuestion({
      ctx: investigation,
      advisory: intake.advisorySnapshot,
      priorAnswers: intake.answers,
      questionTexts: intake.questionTexts ?? {},
      questionsAsked,
      maxQuestions,
      learnedPatterns: investigation.learnedPatterns,
    });

    if (result.intakeComplete || !result.question) {
      return { intakeComplete: true };
    }

    return {
      intakeComplete: false,
      question: {
        id: result.question.id,
        kind: result.question.kind,
        text: result.question.text,
        choices: result.question.choices,
        purpose: result.question.purpose,
        fromExpertLibrary: false,
      },
    };
  },

  buildPostIntakePayload(
    intake: IntakeContext,
    investigation: InvestigationContext
  ): PostIntakeDiagnosisPayload {
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(intake.answers)) {
      answers[k] = String(v);
    }
    const issueLabelHint = diagnosisFollowUpReasoningEngine.inferPrimaryIssueFromIntake(
      intake.initialSymptoms,
      answers,
      intake.questionTexts ?? {},
      intake.questionChoices ?? {},
      investigation
    );
    const investigationPattern =
      Object.keys(answers).length > 0
        ? diagnosisFollowUpQuestionGenerator.buildInvestigationPattern({
            initialSymptoms: intake.initialSymptoms,
            issueLabel: issueLabelHint,
            answers,
            questionTexts: intake.questionTexts ?? {},
            questionKinds: intake.questionKinds ?? {},
            questionChoices: intake.questionChoices ?? {},
          })
        : undefined;

    return {
      enrichedSymptoms: diagnosisFollowUpReasoningEngine.enrichSymptomsFromAnswers(
        intake.initialSymptoms,
        answers,
        intake.questionTexts ?? {},
        intake.questionChoices ?? {},
        investigation
      ),
      fieldInvestigation: diagnosisFollowUpReasoningEngine.formatFieldInvestigationSummary(
        answers,
        intake.questionTexts ?? {},
        intake.questionChoices ?? {},
        investigation
      ),
      issueLabelHint,
      skipReuseCache: true,
      investigationPattern,
    };
  },

  async startIntake(params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    symptomsText: string;
    cropType: string;
    hasPhoto: boolean;
  }): Promise<{ started: boolean; mode?: 'learned' | 'evidence' }> {
    if (!this.enabled()) return { started: false };

    const ctx = await this.buildInvestigationContext(params);
    const band = diagnosisFollowUpReasoningEngine.resolveMatchConfidenceBand(ctx.matchConfidence);

    if (diagnosisFollowUpReasoningEngine.shouldSkipFollowUpIntake(ctx)) {
      logger.info(
        { farmerId: params.farmerId, score: ctx.matchConfidence, band },
        'Diagnosis follow-up skipped: high confidence + photo'
      );
      return { started: false };
    }

    const hasLearnedPool =
      ctx.totalVerifiedCases >= MIN_SIMILAR_CASES() || ctx.similarCases.length >= MIN_SIMILAR_CASES();

    const { data: farmerRow } = await supabase
      .from('farmers')
      .select('district')
      .eq('id', params.farmerId)
      .maybeSingle();
    const district = farmerRow?.district ? String(farmerRow.district).trim().toLowerCase() : null;

    const savedLibrary = await expertFollowUpLearningService.findForFarmer({
      cropType: params.cropType,
      district,
      symptomsText: params.symptomsText,
      issueLabelHint: ctx.bestIssueLabel,
      language: params.language,
      max: MAX_QUESTIONS(),
    });

    const hasSavedQuestions = savedLibrary.length > 0;
    const evidenceMode =
      !hasLearnedPool &&
      !hasSavedQuestions &&
      diagnosisFollowUpReasoningEngine.needsMoreEvidence(ctx);

    if (!hasLearnedPool && !hasSavedQuestions && !evidenceMode) {
      logger.info(
        {
          farmerId: params.farmerId,
          verified: ctx.totalVerifiedCases,
          similar: ctx.similarCases.length,
        },
        'Diagnosis follow-up skipped: no learned pool and evidence not required'
      );
      return { started: false };
    }

    if (
      ctx.matchConfidence >= STRONG_MATCH_SCORE() &&
      params.hasPhoto &&
      band === 'high' &&
      !evidenceMode
    ) {
      return { started: false };
    }

    const pendingSavedQuestions: FollowUpQuestion[] = savedLibrary.map((s) => ({
      id: s.id,
      kind: s.kind,
      text: expertFollowUpLearningService.localize(s, params.language),
      choices: s.choices,
      purpose: s.purpose,
      libraryId: s.libraryId,
      fromExpertLibrary: true,
    }));

    const draftIntake: IntakeContext = {
      initialSymptoms: params.symptomsText,
      questions: [],
      currentIndex: 0,
      answers: {},
      questionTexts: {},
      questionKinds: {},
      questionChoices: {},
      questionsAsked: 0,
      maxQuestions: MAX_QUESTIONS(),
      pendingSavedQuestions: [...pendingSavedQuestions],
      similarCases: ctx.similarCases.slice(0, 5).map((c) => ({
        issueLabel: c.issueLabel,
        score: c.score,
        reuseCaseId: c.reuseCaseId,
      })),
      bestIssueLabel: ctx.bestIssueLabel,
      matchConfidence: ctx.matchConfidence,
      totalVerifiedCases: ctx.totalVerifiedCases,
      confidenceBand: band,
      pendingPhoto: !params.hasPhoto,
      evidenceMode: evidenceMode && !hasSavedQuestions,
    };

    const planned = await this.planNextQuestionForIntake(ctx, draftIntake, {
      farmerId: params.farmerId,
    });

    if (planned.intakeComplete || !planned.question) return { started: false };

    const intake: IntakeContext = {
      ...draftIntake,
      questions: [planned.question],
    };
    attachQuestionToIntake(intake, planned.question);

    await conversationSessionService.patchContext(params.farmerId, { diagnosisIntake: intake });
    await conversationSessionService.setState(params.farmerId, 'diagnosis_intake');

    const intro = diagnosisFollowUpReasoningEngine.buildIntro(ctx);
    await this.sendCurrentQuestion(params.phone, params.language, intake, intro);
    return { started: true, mode: hasSavedQuestions ? 'learned' : evidenceMode ? 'evidence' : 'learned' };
  },

  async sendCurrentQuestion(
    phone: string,
    language: AdvisoryLanguage,
    intake: IntakeContext,
    prefix?: string
  ): Promise<void> {
    const q = intake.questions[intake.currentIndex];
    if (!q) return;

    const step =
      intake.maxQuestions && intake.maxQuestions > 1
        ? language === 'ml'
          ? `(ചോദ്യം ${intake.currentIndex + 1} / ${intake.maxQuestions} വരെ)\n\n`
          : `(Question ${intake.currentIndex + 1} of up to ${intake.maxQuestions})\n\n`
        : '';
    const body = prefix ? `${prefix}\n\n${step}${q.text}` : `${step}${q.text}`;

    if (q.kind === 'photo') {
      await whatsappService.sendText(
        phone,
        language === 'ml'
          ? `${body}\n\n(അടുത്ത ഫോട്ടോ അയയ്ക്കൂ, അല്ലെങ്കിൽ "skip" ടൈപ്പ് ചെയ്യൂ.)`
          : `${body}\n\n(Send a close photo, or type skip.)`
      );
      return;
    }

    const choices = q.choices?.length
      ? q.choices
      : intake.questionChoices?.[q.id]?.length
        ? intake.questionChoices[q.id]
        : YES_NO_CHOICES;

    try {
      await sendStructuredChoices({ phone, language, body, questionId: q.id, choices });
      return;
    } catch {
      const labels = choices.map((c) => localizeChoice(c, language)).join(' / ');
      await whatsappService.sendText(phone, `${body}\n\nReply: ${labels}`);
    }
  },

  parseButtonReply(text: string): { questionId: string; answer: string } | null {
    const yesNo = text.match(/^dfq\.(yes|no)\.(.+)$/);
    if (yesNo) {
      return { questionId: yesNo[2], answer: yesNo[1] };
    }
    const choice = text.match(/^dfq\.choice\.([^.]+)\.(.+)$/);
    if (choice) {
      return { questionId: choice[2], answer: choice[1] };
    }
    const spray = text.match(/^dfq\.spray\.(7d|14d|never)\.(.+)$/);
    if (spray) {
      const map: Record<string, string> = { '7d': 'within_7d', '14d': 'over_14d', never: 'never' };
      return { questionId: spray[2], answer: map[spray[1]] ?? spray[1] };
    }
    return null;
  },

  parseTextAnswer(
    text: string
  ): 'yes' | 'no' | 'skip' | 'within_7d' | 'over_14d' | 'never' | 'unsure' | null {
    const t = text.trim().toLowerCase();
    if (/^(skip|പിന്നീട്|നാളെ)$/i.test(t)) return 'skip';
    if (/^(yes|y|അതെ|ഉണ്ട|haan|हाँ|हां|ஆம்|ಹೌದು|1)$/i.test(t)) return 'yes';
    if (/^(no|n|ഇല്ല|illa|नहीं|இல்லை|ಇಲ್ಲ|2)$/i.test(t)) return 'no';
    if (/^(7|7d|week|last week|7 days|7 ദിവസം)/i.test(t)) return 'within_7d';
    if (/^(14|14d|2 week|month|never|not|ഇല്ല)/i.test(t)) return 'over_14d';
    return null;
  },

  async handleIntakeMessage(params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    text: string;
    hasPhoto: boolean;
  }): Promise<
    | { handled: true; ready: false }
    | { handled: true; ready: true; postIntake: PostIntakeDiagnosisPayload; escalateHint?: boolean }
    | { handled: false }
  > {
    const ctx = await conversationSessionService.getContext(params.farmerId);
    const intake = ctx.diagnosisIntake;
    if (!intake?.questions?.length) return { handled: false };

    const current = intake.questions[intake.currentIndex];
    if (!current) {
      const investigation = await this.buildInvestigationContext({
        farmerId: params.farmerId,
        language: params.language,
        symptomsText: intake.initialSymptoms,
        cropType: (await farmerMemoryService.build(params.farmerId)).cropType,
        hasPhoto: params.hasPhoto || !intake.pendingPhoto,
      });
      return {
        handled: true,
        ready: true,
        postIntake: this.buildPostIntakePayload(intake, investigation),
        escalateHint: intake.confidenceBand === 'low',
      };
    }

    const isPhotoQ = current.kind === 'photo';

    if (isPhotoQ && params.hasPhoto) {
      intake.answers[current.id] = 'yes';
      intake.questionsAsked = (intake.questionsAsked ?? 0) + 1;
      intake.currentIndex += 1;
      intake.pendingPhoto = false;

      const investigation = await this.buildInvestigationContext({
        farmerId: params.farmerId,
        language: params.language,
        symptomsText: intake.initialSymptoms,
        cropType: (await farmerMemoryService.build(params.farmerId)).cropType,
        hasPhoto: true,
      });
      const next = await this.planNextQuestionForIntake(investigation, intake, {
        farmerId: params.farmerId,
      });
      if (!next.intakeComplete && next.question) {
        intake.questions.push(next.question);
        attachQuestionToIntake(intake, next.question);
      }
    } else if (isPhotoQ) {
      const skip = /skip/i.test(params.text);
      if (!skip && !params.hasPhoto) {
        await whatsappService.sendText(
          params.phone,
          params.language === 'ml'
            ? 'ദയവായി അടുത്ത ഫോട്ടോ അയയ്ക്കൂ, അല്ലെങ്കിൽ "skip" എന്ന് ടൈപ്പ് ചെയ്യൂ.'
            : 'Please send a close photo, or type skip.'
        );
        return { handled: true, ready: false };
      }
      intake.answers[current.id] = skip ? 'skip' : 'yes';
      intake.questionsAsked = (intake.questionsAsked ?? 0) + 1;
      intake.currentIndex += 1;
      if (!skip) intake.pendingPhoto = false;

      const investigation = await this.buildInvestigationContext({
        farmerId: params.farmerId,
        language: params.language,
        symptomsText: intake.initialSymptoms,
        cropType: (await farmerMemoryService.build(params.farmerId)).cropType,
        hasPhoto: !skip && (params.hasPhoto || !intake.pendingPhoto),
      });
      const next = await this.planNextQuestionForIntake(investigation, intake, {
        farmerId: params.farmerId,
      });
      if (!next.intakeComplete && next.question) {
        intake.questions.push(next.question);
        attachQuestionToIntake(intake, next.question);
      }
    } else {
      const choices =
        current.choices?.length
          ? current.choices
          : intake.questionChoices?.[current.id] ?? YES_NO_CHOICES;
      const choiceIds = new Set(choices.map((c) => c.id));

      const btn = this.parseButtonReply(params.text);
      let answer = btn?.questionId === current.id ? btn.answer : undefined;

      if (!answer) {
        const typed = this.parseTextAnswer(params.text);
        if (typed && choiceIds.has(typed)) answer = typed;
        else if (typed === 'yes' || typed === 'no') answer = typed;
      }

      if (!answer || !choiceIds.has(answer)) {
        if (farmerSentCropEvidence(params)) {
          await abandonDiagnosisIntake(params.farmerId);
          logger.info(
            { farmerId: params.farmerId, hasPhoto: params.hasPhoto, text: params.text?.slice(0, 80) },
            'Diagnosis intake abandoned — farmer sent crop photo/symptoms instead of structured answer'
          );
          return { handled: false };
        }
        await this.sendCurrentQuestion(
          params.phone,
          params.language,
          intake,
          intakeAnswerHint(params.language)
        );
        return { handled: true, ready: false };
      }

      intake.answers[current.id] = answer;
      intake.questionsAsked = (intake.questionsAsked ?? 0) + 1;
      intake.currentIndex += 1;

      const investigation = await this.buildInvestigationContext({
        farmerId: params.farmerId,
        language: params.language,
        symptomsText: intake.initialSymptoms,
        cropType: (await farmerMemoryService.build(params.farmerId)).cropType,
        hasPhoto: params.hasPhoto || !intake.pendingPhoto,
      });

      const next = await this.planNextQuestionForIntake(investigation, intake, {
        farmerId: params.farmerId,
      });
      if (!next.intakeComplete && next.question) {
        intake.questions.push(next.question);
        attachQuestionToIntake(intake, next.question);
      }
    }

    await conversationSessionService.patchContext(params.farmerId, { diagnosisIntake: intake });

    if (intake.currentIndex >= intake.questions.length) {
      const sessCtx = await conversationSessionService.getContext(params.farmerId);
      const investigation = await this.buildInvestigationContext({
        farmerId: params.farmerId,
        language: params.language,
        symptomsText: intake.initialSymptoms,
        cropType: (await farmerMemoryService.build(params.farmerId)).cropType,
        hasPhoto: params.hasPhoto || !intake.pendingPhoto || Boolean(sessCtx.pendingDiagnosisImagePath),
      });
      const postIntake = this.buildPostIntakePayload(intake, investigation);
      await conversationSessionService.patchContext(params.farmerId, {
        diagnosisIntake: undefined,
      });
      await conversationSessionService.setState(params.farmerId, 'diagnosis');
      logger.info(
        {
          farmerId: params.farmerId,
          bestIssue: intake.bestIssueLabel,
          inferredIssue: postIntake.issueLabelHint,
          matchConfidence: intake.matchConfidence,
          confidenceBand: intake.confidenceBand,
          answerCount: Object.keys(intake.answers).length,
          evidenceMode: intake.evidenceMode,
        },
        'Diagnosis intake complete'
      );
      return {
        handled: true,
        ready: true,
        postIntake,
        escalateHint: intake.confidenceBand === 'low' && (intake.matchConfidence ?? 0) < 0.7,
      };
    }

    await this.sendCurrentQuestion(params.phone, params.language, intake);
    return { handled: true, ready: false };
  },

  shouldDeferDiagnosisDelivery(confidence: number): boolean {
    if (!this.enabled()) return false;
    return confidence < getReviewThreshold();
  },

  async startPostDiagnosisClarification(params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    sessionId: string;
    advisory: StructuredAdvisory;
    escalated: boolean;
    reused: boolean;
    plotLabel?: string;
    symptomsText?: string;
  }): Promise<boolean> {
    if (!this.enabled()) return false;
    if (!this.shouldDeferDiagnosisDelivery(params.advisory.confidence)) return false;

    const memory = await farmerMemoryService.build(params.farmerId, {
      symptomsText: params.symptomsText,
    });
    const investigation = await this.buildInvestigationContext({
      farmerId: params.farmerId,
      language: params.language,
      symptomsText:
        params.symptomsText?.trim() ||
        `${memory.cropType} crop field issue — post photo analysis`,
      cropType: memory.cropType,
      hasPhoto: true,
    });

    const draftIntake: PostDiagnosisIntakeContext = {
      sessionId: params.sessionId,
      cropType: memory.cropType,
      advisorySnapshot: toAdvisorySnapshot(params.advisory),
      questions: [],
      currentIndex: 0,
      answers: {},
      questionTexts: {},
      questionKinds: {},
      questionChoices: {},
      questionsAsked: 0,
      maxQuestions: MAX_POST_DIAGNOSIS_QUESTIONS(),
    };

    const planned = await this.planNextPostDiagnosisQuestion(investigation, draftIntake);
    if (planned.intakeComplete || !planned.question) return false;

    const intake: PostDiagnosisIntakeContext = {
      ...draftIntake,
      questions: [planned.question],
    };
    attachPostQuestionToIntake(intake, planned.question);

    await conversationSessionService.patchContext(params.farmerId, {
      postDiagnosisIntake: intake,
      pendingDiagnosisDelivery: {
        sessionId: params.sessionId,
        escalated: params.escalated,
        reused: params.reused,
        confidence: params.advisory.confidence,
        plotLabel: params.plotLabel,
      },
    });
    await conversationSessionService.setState(params.farmerId, 'post_diagnosis_intake');

    const intro = diagnosisFollowUpReasoningEngine.buildPostDiagnosisIntro({
      language: params.language,
      probableIssue: params.advisory.probableIssue,
      confidence: params.advisory.confidence,
      differentialCount: params.advisory.differentialDiagnosis?.length ?? 0,
    });

    await this.sendPostDiagnosisQuestion(params.phone, params.language, intake, intro);
    logger.info(
      {
        farmerId: params.farmerId,
        sessionId: params.sessionId,
        confidence: params.advisory.confidence,
        firstQuestionId: planned.question.id,
      },
      'Post-diagnosis AI clarification started'
    );
    return true;
  },

  async sendPostDiagnosisQuestion(
    phone: string,
    language: AdvisoryLanguage,
    intake: PostDiagnosisIntakeContext,
    prefix?: string
  ): Promise<void> {
    const q = intake.questions[intake.currentIndex];
    if (!q) return;

    const step =
      intake.maxQuestions > 1
        ? language === 'ml'
          ? `(ചോദ്യം ${intake.currentIndex + 1} / ${intake.maxQuestions} വരെ)\n\n`
          : `(Question ${intake.currentIndex + 1} of up to ${intake.maxQuestions})\n\n`
        : '';
    const body = prefix ? `${prefix}\n\n${step}${q.text}` : `${step}${q.text}`;

    if (q.kind === 'photo') {
      await whatsappService.sendText(
        phone,
        language === 'ml'
          ? `${body}\n\n(അടുത്ത ഫോട്ടോ അയയ്ക്കൂ, അല്ലെങ്കിൽ "skip" ടൈപ്പ് ചെയ്യൂ.)`
          : `${body}\n\n(Send a close photo, or type skip.)`
      );
      return;
    }

    const choices = q.choices?.length
      ? q.choices
      : intake.questionChoices?.[q.id]?.length
        ? intake.questionChoices[q.id]
        : YES_NO_CHOICES;

    try {
      await sendStructuredChoices({ phone, language, body, questionId: q.id, choices });
      return;
    } catch {
      const labels = choices.map((c) => localizeChoice(c, language)).join(' / ');
      await whatsappService.sendText(phone, `${body}\n\nReply: ${labels}`);
    }
  },

  async handlePostDiagnosisMessage(params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    text: string;
    hasPhoto?: boolean;
  }): Promise<{ handled: boolean; ready?: boolean }> {
    const ctx = await conversationSessionService.getContext(params.farmerId);
    const intake = ctx.postDiagnosisIntake;
    if (!intake?.questions?.length) return { handled: false };

    const current = intake.questions[intake.currentIndex];
    if (!current) {
      return { handled: true, ready: true };
    }

    const isPhotoQ = current.kind === 'photo';

    if (isPhotoQ && params.hasPhoto) {
      intake.answers[current.id] = 'yes';
      intake.questionsAsked = (intake.questionsAsked ?? 0) + 1;
      intake.currentIndex += 1;
    } else if (isPhotoQ) {
      const skip = /skip/i.test(params.text);
      if (!skip && !params.hasPhoto) {
        await whatsappService.sendText(
          params.phone,
          params.language === 'ml'
            ? 'ദയവായി അടുത്ത ഫോട്ടോ അയയ്ക്കൂ, അല്ലെങ്കിൽ "skip" എന്ന് ടൈപ്പ് ചെയ്യൂ.'
            : 'Please send a close photo, or type skip.'
        );
        return { handled: true, ready: false };
      }
      intake.answers[current.id] = skip ? 'skip' : 'yes';
      intake.questionsAsked = (intake.questionsAsked ?? 0) + 1;
      intake.currentIndex += 1;
    } else {
      const choices =
        current.choices?.length
          ? current.choices
          : intake.questionChoices?.[current.id] ?? YES_NO_CHOICES;
      const choiceIds = new Set(choices.map((c) => c.id));

      const btn = this.parseButtonReply(params.text);
      let answer = btn?.questionId === current.id ? btn.answer : undefined;

      if (!answer) {
        const typed = this.parseTextAnswer(params.text);
        if (typed && choiceIds.has(typed)) answer = typed;
        else if (typed === 'yes' || typed === 'no') answer = typed;
      }

      if (!answer || !choiceIds.has(answer)) {
        await this.sendPostDiagnosisQuestion(
          params.phone,
          params.language,
          intake,
          intakeAnswerHint(params.language)
        );
        return { handled: true, ready: false };
      }

      intake.answers[current.id] = answer;
      intake.questionsAsked = (intake.questionsAsked ?? 0) + 1;
      intake.currentIndex += 1;
    }

    const investigation = await this.buildInvestigationContext({
      farmerId: params.farmerId,
      language: params.language,
      symptomsText: `${intake.cropType} crop — post-diagnosis clarification`,
      cropType: intake.cropType,
      hasPhoto: true,
    });

    const next = await this.planNextPostDiagnosisQuestion(investigation, intake);
    if (!next.intakeComplete && next.question) {
      intake.questions.push(next.question);
      attachPostQuestionToIntake(intake, next.question);
    }

    await conversationSessionService.patchContext(params.farmerId, { postDiagnosisIntake: intake });

    if (intake.currentIndex >= intake.questions.length) {
      await conversationSessionService.patchContext(params.farmerId, {
        postDiagnosisIntake: undefined,
      });
      await conversationSessionService.setState(params.farmerId, 'diagnosis');
      logger.info(
        {
          farmerId: params.farmerId,
          sessionId: intake.sessionId,
          answerCount: Object.keys(intake.answers).length,
        },
        'Post-diagnosis clarification complete'
      );
      return { handled: true, ready: true };
    }

    await this.sendPostDiagnosisQuestion(params.phone, params.language, intake);
    return { handled: true, ready: false };
  },

  async resolveAfterIntake(params: {
    farmerId: string;
    cropType: string;
    activePlotId?: string | null;
    enrichedSymptoms: string;
    compactHistory?: string;
  }): Promise<{ reused: boolean; matchIssue?: string }> {
    const district = await supabase
      .from('farmers')
      .select('district')
      .eq('id', params.farmerId)
      .maybeSingle()
      .then((r) =>
        r.data?.district ? String(r.data.district).trim().toLowerCase() : null
      );

    let dap = 0;
    if (params.activePlotId) {
      const block = await blockService.getById(params.activePlotId, params.farmerId);
      if (block) dap = block.dap;
    } else {
      const primary = await blockService.getPrimaryBlock(params.farmerId);
      dap = primary?.dap ?? 0;
    }

    const match = await aiReuseService.findReusableForFarmerMessage({
      cropType: params.cropType,
      district,
      dapBucket: buildDapBucket(dap),
      text: params.enrichedSymptoms,
      compactHistory: params.compactHistory,
    });

    return {
      reused: Boolean(match),
      matchIssue: match?.issueLabel,
    };
  },
};
