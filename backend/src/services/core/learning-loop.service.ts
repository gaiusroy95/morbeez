import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { buildDapBucket } from '../ai/ai-reuse.service.js';
import type { StructuredAdvisory } from '../ai/types.js';
import { terminologyDictionaryService } from '../regional-terminology/terminology-dictionary.service.js';
import { terminologyEscalationService } from '../regional-terminology/terminology-escalation.service.js';
import { verifiedAdvisoryLearningService } from './verified-advisory-learning.service.js';

/**
 * Phase 5 — close the loop: staff-verified knowledge → reuse cache + terminology library.
 */
export const learningLoopService = {
  async onTerminologyResolved(params: {
    taskId: string;
    term: string;
    language: string;
    meaning: string;
    standardTerm?: string | null;
    cropType?: string | null;
    district?: string | null;
    resolvedBy?: string;
    farmerId?: string | null;
  }): Promise<void> {
    const term = params.term.trim().toLowerCase();
    if (!term || !params.meaning.trim()) return;

    await terminologyDictionaryService.upsertApproved({
      term,
      language: params.language || 'en',
      meaning: params.meaning,
      standardTerm: params.standardTerm ?? params.meaning,
      cropType: params.cropType,
      district: params.district,
      approvedBy: params.resolvedBy,
    });

    await terminologyEscalationService.recordLearningHistory({
      term,
      language: params.language || 'en',
      meaning: params.meaning.trim(),
      standardTerm: params.standardTerm ?? null,
      cropType: params.cropType,
      district: params.district,
      action: 'approved',
      taskId: params.taskId,
      farmerId: params.farmerId,
      approvedBy: params.resolvedBy ?? null,
    });

    if (params.farmerId) {
      const { data: farmer } = await supabase
        .from('farmers')
        .select('phone, preferred_language')
        .eq('id', params.farmerId)
        .maybeSingle();
      if (farmer?.phone) {
        const lang = farmer.preferred_language ?? params.language;
        const msg =
          lang === 'ml'
            ? `"${term}" എന്നത് ഇപ്പോൾ മനസ്സിലാക്കാം: ${params.meaning}`
            : `We learned your term "${term}": ${params.meaning}`;
        await supabase.from('interaction_logs').insert({
          farmer_id: params.farmerId,
          channel: 'whatsapp',
          direction: 'outbound',
          content: msg.slice(0, 500),
        });
      }
    }

    logger.info({ taskId: params.taskId, term }, 'Terminology promoted to agronomy_terms');
  },

  async promoteRecommendationToReuse(recommendationRecordId: string): Promise<void> {
    const { data: rec } = await supabase
      .from('recommendation_records')
      .select(
        'id, farmer_id, block_id, ai_session_id, issue_detected, recommendation_text, products, outcome, status, dap_at_recommendation, farm_blocks(crop_type)'
      )
      .eq('id', recommendationRecordId)
      .maybeSingle();

    if (!rec?.ai_session_id || !rec.farmer_id) return;
    if (rec.outcome && !['better', 'partial'].includes(String(rec.outcome))) return;

    const { data: session } = await supabase
      .from('ai_advisory_sessions')
      .select('id, metadata')
      .eq('id', rec.ai_session_id)
      .maybeSingle();

    const { data: output } = await supabase
      .from('ai_advisory_outputs')
      .select('*')
      .eq('session_id', rec.ai_session_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!output) return;

    const advisory: StructuredAdvisory = {
      probableIssue: String(output.probable_issue ?? rec.issue_detected ?? 'crop issue'),
      confidence: Number((session?.metadata as { confidence?: number })?.confidence ?? 0.75),
      uncertain: false,
      nutrientDeficiency: (output.nutrient_deficiency as StructuredAdvisory['nutrientDeficiency']) ?? [],
      stressAnalysis: (output.stress_analysis as string[]) ?? [],
      treatments: (output.treatment_recommendations as StructuredAdvisory['treatments']) ?? [],
      dosageGuidance: (output.dosage_guidance as StructuredAdvisory['dosageGuidance']) ?? [],
      precautions: (output.precautions as string[]) ?? [],
      escalationRecommended: false,
      farmerSummaryEn: String(output.farmer_summary_en ?? rec.recommendation_text ?? ''),
      farmerSummaryMl: String(output.farmer_summary_ml ?? output.farmer_summary_en ?? rec.recommendation_text ?? ''),
      recommendedProductTags: [],
    };

    const summary =
      rec.recommendation_text?.trim() ||
      advisory.farmerSummaryEn ||
      advisory.probableIssue;

    await verifiedAdvisoryLearningService.promoteVerifiedAnswer({
      sessionId: String(rec.ai_session_id),
      farmerId: String(rec.farmer_id),
      issueLabel: String(rec.issue_detected ?? advisory.probableIssue),
      farmerSummaryEn: summary,
      farmerSummaryMl: advisory.farmerSummaryMl,
      verifiedBy: 'learning_loop',
      products: (rec.products as []) ?? [],
      confidence: advisory.confidence,
      extraSymptomSources: [
        rec.issue_detected ? String(rec.issue_detected) : undefined,
        rec.recommendation_text ? String(rec.recommendation_text) : undefined,
      ],
      global: true,
    });

    logger.info(
      { recommendationRecordId, dapBucket: buildDapBucket(rec.dap_at_recommendation ?? 0) },
      'Promoted to advisory_reuse_cases'
    );
  },

  async onLearningSampleReady(recommendationRecordId: string): Promise<void> {
    const { data: sample } = await supabase
      .from('ai_learning_samples')
      .select('application_confirmed, outcome, escalated')
      .eq('recommendation_record_id', recommendationRecordId)
      .maybeSingle();

    if (!sample?.application_confirmed) return;
    if (sample.escalated) return;
    if (!sample.outcome || ['worsened', 'no_improvement'].includes(String(sample.outcome))) return;

    await this.promoteRecommendationToReuse(recommendationRecordId);
  },
};
