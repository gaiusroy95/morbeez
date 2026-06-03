import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { supabase } from '../../../lib/supabase.js';
import type { AdvisoryLanguage } from '../../ai/types.js';
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
} from './diagnosis-follow-up-reasoning.engine.js';

const MAX_QUESTIONS = () => Number(process.env.DIAGNOSIS_FOLLOW_UP_MAX_QUESTIONS ?? 3);
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
  kind: 'yes_no' | 'photo' | 'spray_timing';
  text: string;
};

type IntakeContext = NonNullable<SessionContext['diagnosisIntake']>;

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
    };
  },

  enrichedSymptoms(intake: IntakeContext): string {
    const ctxStub = {
      language: 'en' as AdvisoryLanguage,
      cropType: '',
      symptomsText: intake.initialSymptoms,
      hasPhoto: true,
      similarCases: [],
      totalVerifiedCases: intake.totalVerifiedCases ?? 0,
      matchConfidence: intake.matchConfidence ?? 0,
      bestIssueLabel: intake.bestIssueLabel,
      heavyRainLikely: false,
      highHumidityLikely: false,
      highHeatLikely: false,
      weatherRiskScore: 0,
      diseasePriors: [],
      lastSprayKnown: true,
      category: 'disease_stress',
    };
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(intake.answers)) {
      answers[k] = String(v);
    }
    return diagnosisFollowUpReasoningEngine.enrichSymptomsFromAnswers(
      intake.initialSymptoms,
      answers,
      ctxStub
    );
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
    const evidenceMode =
      !hasLearnedPool &&
      diagnosisFollowUpReasoningEngine.needsMoreEvidence(ctx);

    if (!hasLearnedPool && !evidenceMode) {
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

    const planned = diagnosisFollowUpReasoningEngine.planQuestionSequence(ctx, MAX_QUESTIONS());
    const questions = planned.map((q) =>
      diagnosisFollowUpReasoningEngine.toWhatsAppQuestion(q, params.language)
    );

    if (!questions.length) return { started: false };

    const intake: IntakeContext = {
      initialSymptoms: params.symptomsText,
      questions,
      currentIndex: 0,
      answers: {},
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
      evidenceMode,
    };

    await conversationSessionService.patchContext(params.farmerId, { diagnosisIntake: intake });
    await conversationSessionService.setState(params.farmerId, 'diagnosis_intake');

    const intro = diagnosisFollowUpReasoningEngine.buildIntro(ctx);
    await this.sendCurrentQuestion(params.phone, params.language, intake, intro);
    return { started: true, mode: evidenceMode ? 'evidence' : 'learned' };
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
      intake.questions.length > 1
        ? language === 'ml'
          ? `(ചോദ്യം ${intake.currentIndex + 1}/${intake.questions.length})\n\n`
          : `(Question ${intake.currentIndex + 1} of ${intake.questions.length})\n\n`
        : '';
    const body = prefix ? `${prefix}\n\n${step}${q.text}` : `${step}${q.text}`;

    if (q.kind === 'yes_no') {
      try {
        await whatsappService.sendButtons({
          to: phone,
          body,
          buttons: [
            { id: `dfq.yes.${q.id}`, title: language === 'ml' ? 'അതെ' : 'Yes' },
            { id: `dfq.no.${q.id}`, title: language === 'ml' ? 'ഇല്ല' : 'No' },
          ],
        });
        return;
      } catch {
        /* fall through */
      }
    }

    if (q.kind === 'spray_timing') {
      try {
        await whatsappService.sendButtons({
          to: phone,
          body,
          buttons: [
            { id: `dfq.spray.7d.${q.id}`, title: language === 'ml' ? '7 ദിവസം' : 'Last 7 days' },
            { id: `dfq.spray.14d.${q.id}`, title: language === 'ml' ? '14+ ദിവസം' : '14+ days ago' },
            { id: `dfq.spray.never.${q.id}`, title: language === 'ml' ? 'ഇല്ല' : 'Not yet' },
          ],
        });
        return;
      } catch {
        /* fall through */
      }
    }

    await whatsappService.sendText(phone, body);
  },

  parseButtonReply(
    text: string
  ): { questionId: string; answer: 'yes' | 'no' | 'within_7d' | 'over_14d' | 'never' } | null {
    const yesNo = text.match(/^dfq\.(yes|no)\.(.+)$/);
    if (yesNo) {
      return { questionId: yesNo[2], answer: yesNo[1] === 'yes' ? 'yes' : 'no' };
    }
    const spray = text.match(/^dfq\.spray\.(7d|14d|never)\.(.+)$/);
    if (spray) {
      const map = { '7d': 'within_7d', '14d': 'over_14d', never: 'never' } as const;
      return { questionId: spray[2], answer: map[spray[1] as keyof typeof map] };
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
    | { handled: true; ready: true; enrichedSymptoms: string; escalateHint?: boolean }
    | { handled: false }
  > {
    const ctx = await conversationSessionService.getContext(params.farmerId);
    const intake = ctx.diagnosisIntake;
    if (!intake?.questions?.length) return { handled: false };

    const current = intake.questions[intake.currentIndex];
    if (!current) {
      return {
        handled: true,
        ready: true,
        enrichedSymptoms: this.enrichedSymptoms(intake),
        escalateHint: intake.confidenceBand === 'low',
      };
    }

    const isPhotoQ = current.kind === 'photo';

    if (isPhotoQ && params.hasPhoto) {
      intake.answers[current.id] = 'yes';
      intake.currentIndex += 1;
      intake.pendingPhoto = false;
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
      intake.currentIndex += 1;
      if (!skip) intake.pendingPhoto = false;
    } else {
      const btn = this.parseButtonReply(params.text);
      const ans = btn?.answer ?? this.parseTextAnswer(params.text);
      const valid = ['yes', 'no', 'skip', 'within_7d', 'over_14d', 'never', 'unsure'];
      if (!ans || !valid.includes(ans)) {
        await whatsappService.sendText(
          params.phone,
          params.language === 'ml' ? 'ബട്ടൺ തിരഞ്ഞെടുക്കൂ അല്ലെങ്കിൽ അതെ/ഇല്ല.' : 'Please use the buttons or reply Yes/No.'
        );
        return { handled: true, ready: false };
      }
      intake.answers[current.id] = btn?.answer ?? ans;

      const investigation = await this.buildInvestigationContext({
        farmerId: params.farmerId,
        language: params.language,
        symptomsText: intake.initialSymptoms,
        cropType: (await farmerMemoryService.build(params.farmerId)).cropType,
        hasPhoto: params.hasPhoto || !intake.pendingPhoto,
      });
      const branch = diagnosisFollowUpReasoningEngine.branchAfterAnswer(
        current.id,
        ans === 'skip' ? 'skip' : (ans as 'yes' | 'no'),
        investigation
      );
      for (const bq of branch) {
        const wq = diagnosisFollowUpReasoningEngine.toWhatsAppQuestion(bq, params.language);
        if (!intake.questions.some((q) => q.id === wq.id)) {
          intake.questions.splice(intake.currentIndex + 1, 0, wq);
        }
      }

      intake.currentIndex += 1;
    }

    await conversationSessionService.patchContext(params.farmerId, { diagnosisIntake: intake });

    if (intake.currentIndex >= intake.questions.length) {
      await conversationSessionService.patchContext(params.farmerId, { diagnosisIntake: undefined });
      await conversationSessionService.setState(params.farmerId, 'diagnosis');
      const enriched = this.enrichedSymptoms(intake);
      logger.info(
        {
          farmerId: params.farmerId,
          bestIssue: intake.bestIssueLabel,
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
        enrichedSymptoms: enriched,
        escalateHint: intake.confidenceBand === 'low' && (intake.matchConfidence ?? 0) < 0.7,
      };
    }

    await this.sendCurrentQuestion(params.phone, params.language, intake);
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
