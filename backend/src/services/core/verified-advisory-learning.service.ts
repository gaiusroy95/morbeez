import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import type { AdvisoryLanguage, StructuredAdvisory } from '../ai/types.js';
import { aiReuseService, buildDapBucket } from '../ai/ai-reuse.service.js';
import {
  buildLooseSymptomKey,
  buildSymptomKey,
} from '../ai/question-reuse-keys.util.js';
import { blockService } from './block.service.js';
import type { DiagnoseResult } from '../ai/types.js';
import {
  buildCrossLanguageIntentSlug,
  pickLocalizedFarmerSummary,
} from '../whatsapp/pipeline/crop-message-intent.service.js';
import { pickLatestOutput, textsLikelySame } from '../admin/case-review-inquiry.util.js';
import { isAgricultureMessage } from '../whatsapp/pipeline/crop-message-intent.service.js';
import { terminologyService } from '../whatsapp/scenarios/terminology.service.js';

const VERIFIED_CONFIDENCE = 0.88;

/** Enrich farmer text with meanings from agronomy_terms (agronomist-approved regional words). */
async function expandFarmerTextWithAgronomyTerms(
  text: string,
  opts: { cropType: string; district: string | null; language: AdvisoryLanguage }
): Promise<string> {
  const parts = [text.trim()];
  const tokens = text.split(/\s+/).filter((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length >= 3);
  const seen = new Set<string>();
  for (const token of tokens.slice(0, 10)) {
    const key = token.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const resolved = await terminologyService.resolveTerm(
      token,
      opts.language,
      opts.district,
      opts.cropType
    );
    if (resolved.found && resolved.meaning) {
      parts.push(resolved.meaning);
    }
  }
  return parts.filter(Boolean).join(' ');
}

export type PromoteVerifiedAnswerInput = {
  sessionId: string;
  farmerId: string;
  issueLabel: string;
  /** Farmer-facing answer (English). */
  farmerSummaryEn: string;
  farmerSummaryMl?: string;
  verifiedBy: string;
  products?: DiagnoseResult['productRecommendations'];
  confidence?: number;
  /** Extra strings to index (e.g. agronomist diagnosis label). */
  extraSymptomSources?: (string | undefined | null)[];
  /** When true, index under district '' so all regions get this answer for the same question. */
  global?: boolean;
  /** WhatsApp intake Q&A — indexed so AI can plan follow-ups for similar cases. */
  investigationPattern?: {
    initialSymptoms: string;
    issueLabel: string;
    qa: Array<{ question: string; answer: string; kind?: string }>;
  };
};

function uniqueSymptomKeys(sources: (string | undefined | null)[]): string[] {
  const keys = new Set<string>();
  for (const raw of sources) {
    const t = raw?.trim();
    if (!t || t.length < 4) continue;
    keys.add(buildSymptomKey(t));
    keys.add(buildLooseSymptomKey(t));
  }
  if (!keys.size) keys.add(buildSymptomKey('_verified_field_issue_'));
  return [...keys];
}

function buildVerifiedAdvisory(params: {
  issueLabel: string;
  farmerSummaryEn: string;
  farmerSummaryMl?: string;
  confidence?: number;
  products?: DiagnoseResult['productRecommendations'];
}): StructuredAdvisory {
  const en = params.farmerSummaryEn.trim();
  const ml = (params.farmerSummaryMl ?? en).trim();
  return {
    probableIssue: params.issueLabel.trim().slice(0, 200) || 'Verified field guidance',
    confidence: params.confidence ?? VERIFIED_CONFIDENCE,
    uncertain: false,
    nutrientDeficiency: [],
    stressAnalysis: [],
    treatments: [],
    dosageGuidance: [],
    precautions: ['Verified by Morbeez agronomy team.'],
    escalationRecommended: false,
    farmerSummaryEn: en,
    farmerSummaryMl: ml,
    recommendedProductTags: [],
    staffVerified: true,
  } as StructuredAdvisory & { staffVerified: true };
}

/**
 * Permanent verified answers for WhatsApp / Crop Doctor reuse.
 * When staff corrects an AI reply, we index it by the farmer's original question text
 * so the same (or similar) question returns the edited answer — for any farmer in region + globally.
 */
export const verifiedAdvisoryLearningService = {
  uniqueSymptomKeys,

  async loadSessionQuestionSources(sessionId: string): Promise<{
    cropType: string;
    symptomsText: string | null;
    voiceTranscript: string | null;
    investigationPattern?: PromoteVerifiedAnswerInput['investigationPattern'];
  } | null> {
    const { data } = await supabase
      .from('ai_advisory_sessions')
      .select('crop_type, symptoms_text, voice_transcript, metadata')
      .eq('id', sessionId)
      .maybeSingle();
    if (!data) return null;
    const meta = data.metadata as { investigationPattern?: PromoteVerifiedAnswerInput['investigationPattern'] } | null;
    return {
      cropType: String(data.crop_type ?? 'ginger').toLowerCase(),
      symptomsText: data.symptoms_text ? String(data.symptoms_text) : null,
      voiceTranscript: data.voice_transcript ? String(data.voice_transcript) : null,
      investigationPattern: meta?.investigationPattern,
    };
  },

  /**
   * Index agronomist-verified answer for reuse (regional + optional global district '').
   */
  async promoteVerifiedAnswer(input: PromoteVerifiedAnswerInput): Promise<{
    symptomKeys: string[];
    districts: string[];
  }> {
    const session = await this.loadSessionQuestionSources(input.sessionId);
    const cropType = session?.cropType ?? 'ginger';

    const { data: farmer } = await supabase
      .from('farmers')
      .select('district')
      .eq('id', input.farmerId)
      .maybeSingle();

    const primary = await blockService.getPrimaryBlock(input.farmerId);
    const dap = primary?.dap ?? 0;
    const district =
      farmer?.district != null ? String(farmer.district).trim().toLowerCase() : null;

    const intentSlug = buildCrossLanguageIntentSlug(
      cropType,
      [session?.symptomsText, session?.voiceTranscript].filter(Boolean).join(' '),
      input.issueLabel
    );

    const expandedQuestion = await expandFarmerTextWithAgronomyTerms(
      [session?.symptomsText, session?.voiceTranscript].filter(Boolean).join(' '),
      { cropType, district, language: 'en' }
    );

    const symptomKeys = uniqueSymptomKeys([
      session?.symptomsText,
      session?.voiceTranscript,
      expandedQuestion,
      input.issueLabel,
      intentSlug,
      ...(input.extraSymptomSources ?? []),
    ]);

    const districts: string[] = [];
    if (district) districts.push(district);
    if (input.global !== false) districts.push('');
    if (!districts.length) districts.push('');

    const advisory = buildVerifiedAdvisory({
      issueLabel: input.issueLabel,
      farmerSummaryEn: input.farmerSummaryEn,
      farmerSummaryMl: input.farmerSummaryMl,
      confidence: input.confidence,
      products: input.products,
    }) as StructuredAdvisory & {
      staffVerified: true;
      investigationPatterns?: PromoteVerifiedAnswerInput['investigationPattern'][];
    };

    const pattern =
      input.investigationPattern ?? session?.investigationPattern;
    if (pattern?.qa?.length) {
      advisory.investigationPatterns = [
        {
          ...pattern,
          issueLabel: pattern.issueLabel || input.issueLabel,
        },
      ];
    }

    for (const symptomKey of symptomKeys) {
      for (const d of districts) {
        await aiReuseService.indexSuccessfulCase({
          sessionId: input.sessionId,
          farmerId: input.farmerId,
          cropType,
          district: d || null,
          dap,
          symptomKey,
          advisory,
          products: input.products ?? [],
          escalated: false,
        });
      }
    }

    await this.patchSessionOutput(input.sessionId, advisory);

    logger.info(
      {
        sessionId: input.sessionId,
        verifiedBy: input.verifiedBy,
        symptomKeys,
        districts,
        issue: input.issueLabel.slice(0, 80),
      },
      'Promoted verified advisory for permanent reuse'
    );

    return { symptomKeys, districts };
  },

  async patchSessionOutput(sessionId: string, advisory: StructuredAdvisory): Promise<void> {
    const { data: latest } = await supabase
      .from('ai_advisory_outputs')
      .select('id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const patch = {
      probable_issue: advisory.probableIssue,
      farmer_summary_en: advisory.farmerSummaryEn,
      farmer_summary_ml: advisory.farmerSummaryMl,
      precautions: advisory.precautions,
      raw_response: { ...advisory, staffVerified: true },
      model_version: 'staff_verified',
      updated_at: new Date().toISOString(),
    };

    if (latest?.id) {
      await supabase.from('ai_advisory_outputs').update(patch).eq('id', latest.id);
    } else {
      const { data: sess } = await supabase
        .from('ai_advisory_sessions')
        .select('language')
        .eq('id', sessionId)
        .maybeSingle();
      await supabase.from('ai_advisory_outputs').insert({
        session_id: sessionId,
        provider: 'staff_verified',
        language: sess?.language ?? 'en',
        ...patch,
      });
    }
  },

  /**
   * Match farmer free-text to a verified reuse case (before OpenAI).
   */
  async matchFarmerQuestion(params: {
    farmerId: string;
    cropType: string;
    text: string;
    language?: AdvisoryLanguage;
    activePlotId?: string | null;
  }): Promise<{
    advisory: StructuredAdvisory;
    issueLabel: string;
    reuseCaseId: string;
  } | null> {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('district')
      .eq('id', params.farmerId)
      .maybeSingle();
    const district = farmer?.district ? String(farmer.district).trim().toLowerCase() : null;

    let dap = 0;
    if (params.activePlotId) {
      const block = await blockService.getById(params.activePlotId, params.farmerId);
      if (block) dap = block.dap;
    } else {
      const primary = await blockService.getPrimaryBlock(params.farmerId);
      dap = primary?.dap ?? 0;
    }

    const lang = params.language ?? 'en';
    const expandedText = await expandFarmerTextWithAgronomyTerms(params.text.trim(), {
      cropType: params.cropType.toLowerCase(),
      district,
      language: lang,
    });

    const match = await aiReuseService.findReusableForFarmerMessage({
      cropType: params.cropType.toLowerCase(),
      district,
      dapBucket: buildDapBucket(dap),
      text: expandedText || params.text.trim(),
    });

    if (match) {
      return {
        advisory: {
          ...match.advisory,
          farmerSummaryEn: pickLocalizedFarmerSummary(match.advisory, lang),
        },
        issueLabel: match.issueLabel,
        reuseCaseId: match.id,
      };
    }

    const peer = await this.matchPeerRecentSession({
      farmerId: params.farmerId,
      cropType: params.cropType,
      text: params.text.trim(),
      language: lang,
    });
    return peer;
  },

  /**
   * Same farmer asked again in another language — reuse recent diagnosis content.
   */
  async matchPeerRecentSession(params: {
    farmerId: string;
    cropType: string;
    text: string;
    language: AdvisoryLanguage;
  }): Promise<{
    advisory: StructuredAdvisory;
    issueLabel: string;
    reuseCaseId: string;
  } | null> {
    if (!isAgricultureMessage(params.text)) return null;

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: sessions } = await supabase
      .from('ai_advisory_sessions')
      .select('id, symptoms_text, ai_advisory_outputs(*)')
      .eq('farmer_id', params.farmerId)
      .eq('crop_type', params.cropType.toLowerCase())
      .gte('created_at', since)
      .in('status', ['completed', 'escalated'])
      .order('created_at', { ascending: false })
      .limit(5);

    for (const row of sessions ?? []) {
      const prevQ = String(row.symptoms_text ?? '').trim();
      if (!prevQ) continue;
      if (!textsLikelySame(prevQ, params.text)) continue;

      const latest = pickLatestOutput(row.ai_advisory_outputs as unknown[]);
      if (!latest) continue;

      const advisory: StructuredAdvisory = {
        probableIssue: String(latest.probable_issue ?? 'Crop issue'),
        confidence: 0.85,
        uncertain: false,
        nutrientDeficiency: [],
        stressAnalysis: [],
        treatments: [],
        dosageGuidance: [],
        precautions: Array.isArray(latest.precautions) ? (latest.precautions as string[]) : [],
        escalationRecommended: false,
        farmerSummaryEn: String(latest.farmer_summary_en ?? ''),
        farmerSummaryMl: String(
          latest.farmer_summary_ml ?? latest.farmer_summary_en ?? ''
        ),
        recommendedProductTags: [],
      };

      const body = pickLocalizedFarmerSummary(advisory, params.language);
      if (!body || body.length < 20) continue;

      return {
        advisory: { ...advisory, farmerSummaryEn: body },
        issueLabel: advisory.probableIssue,
        reuseCaseId: `peer:${row.id}`,
      };
    }

    return null;
  },

  formatFarmerMessage(advisory: StructuredAdvisory, language: AdvisoryLanguage): string {
    const body = pickLocalizedFarmerSummary(advisory, language);
    return body || advisory.probableIssue || '';
  },

  async promoteFromRecommendationRecord(
    recommendationRecordId: string,
    verifiedBy: string
  ): Promise<void> {
    const { data: rec } = await supabase
      .from('recommendation_records')
      .select(
        'id, farmer_id, ai_session_id, issue_detected, recommendation_text, products, metadata, farm_blocks(crop_type)'
      )
      .eq('id', recommendationRecordId)
      .maybeSingle();

    if (!rec?.ai_session_id || !rec.farmer_id || !rec.recommendation_text?.trim()) return;

    const meta = rec.metadata as { farmerQuestion?: string | null } | null;
    const farmerQuestion =
      meta?.farmerQuestion && String(meta.farmerQuestion).trim().length >= 4
        ? String(meta.farmerQuestion).trim()
        : undefined;

    await this.promoteVerifiedAnswer({
      sessionId: String(rec.ai_session_id),
      farmerId: String(rec.farmer_id),
      issueLabel: String(rec.issue_detected ?? 'crop issue'),
      farmerSummaryEn: String(rec.recommendation_text).trim(),
      verifiedBy,
      products: (rec.products as DiagnoseResult['productRecommendations']) ?? [],
      extraSymptomSources: [
        farmerQuestion,
        rec.issue_detected ? String(rec.issue_detected) : undefined,
      ],
      global: true,
      investigationPattern: (
        await this.loadSessionQuestionSources(String(rec.ai_session_id))
      )?.investigationPattern,
    });
  },
};
