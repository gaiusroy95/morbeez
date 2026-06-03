import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import type { ReviewAction, FarmerFeedbackDecision, ImageReviewAction } from '../../domain/ai-training/enums.js';

export type TrainingReviewSurface =
  | 'case_review'
  | 'farmer_feedback'
  | 'telecaller_escalation'
  | 'field_finding'
  | 'image_review';

export type TrainingHumanAction = ReviewAction | FarmerFeedbackDecision | ImageReviewAction;

export type RecordTrainingEventInput = {
  farmerId: string;
  blockId?: string | null;
  aiSessionId?: string | null;
  escalationId?: string | null;
  recommendationRecordId?: string | null;
  fieldFindingId?: string | null;
  farmerFeedbackId?: string | null;
  source?: 'whatsapp' | 'field_visit' | 'crm' | 'api';
  reviewSurface: TrainingReviewSurface;
  aiPrediction?: string | null;
  aiConfidence?: number | null;
  aiTopK?: Array<{ label: string; confidence?: number | null }>;
  humanAction: TrainingHumanAction;
  humanFinalLabel?: string | null;
  correctionReason?: string | null;
  confidenceBefore?: number | null;
  confidenceAfter?: number | null;
  reviewedBy: string;
  metadata?: Record<string, unknown>;
};

export const aiTrainingEventService = {
  async record(input: RecordTrainingEventInput): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('ai_training_events')
        .insert({
          farmer_id: input.farmerId,
          block_id: input.blockId ?? null,
          ai_session_id: input.aiSessionId ?? null,
          escalation_id: input.escalationId ?? null,
          recommendation_record_id: input.recommendationRecordId ?? null,
          field_finding_id: input.fieldFindingId ?? null,
          farmer_feedback_id: input.farmerFeedbackId ?? null,
          source: input.source ?? 'whatsapp',
          review_surface: input.reviewSurface,
          ai_prediction: input.aiPrediction ?? null,
          ai_confidence: input.aiConfidence ?? null,
          ai_top_k: input.aiTopK ?? [],
          human_action: input.humanAction,
          human_final_label: input.humanFinalLabel ?? null,
          correction_reason: input.correctionReason ?? null,
          confidence_before: input.confidenceBefore ?? null,
          confidence_after: input.confidenceAfter ?? null,
          reviewed_by: input.reviewedBy,
          metadata: input.metadata ?? {},
        })
        .select('id')
        .single();

      if (error) {
        logger.warn({ err: error.message, surface: input.reviewSurface }, 'AI training event insert failed');
        return null;
      }

      const eventId = String(data.id);
      void (async () => {
        try {
          const { weatherSnapshotService } = await import('./weather-snapshot.service.js');
          const weather = await weatherSnapshotService.resolveForTraining({
            farmerId: input.farmerId,
            blockId: input.blockId,
            reviewSurface: input.reviewSurface,
            fieldFindingId: input.fieldFindingId,
            aiSessionId: input.aiSessionId,
            linkEventId: eventId,
          });
          if (weather.weatherSnapshotId || Object.keys(weather.weatherContext).length > 0) {
            const meta = {
              ...((input.metadata as Record<string, unknown>) ?? {}),
              weatherSnapshotId: weather.weatherSnapshotId,
              weatherContext: weather.weatherContext,
            };
            await supabase.from('ai_training_events').update({ metadata: meta }).eq('id', eventId);
          }
        } catch (weatherErr) {
          logger.warn({ err: weatherErr, eventId }, 'Training event weather enrich failed');
        }
      })();

      return eventId;
    } catch (err) {
      logger.warn({ err, surface: input.reviewSurface }, 'AI training event record failed');
      return null;
    }
  },

  async recordFromCaseReview(params: {
    farmerId: string;
    blockId?: string | null;
    aiSessionId?: string | null;
    escalationId: string;
    recommendationRecordId?: string | null;
    aiPrediction?: string | null;
    aiConfidence?: number | null;
    aiTopK?: Array<{ label: string; confidence?: number | null }>;
    action: ReviewAction;
    correctDiagnosis?: string | null;
    notesForLearning?: string | null;
    reviewedBy: string;
  }): Promise<string | null> {
    const humanFinalLabel =
      params.action === 'approve_ai'
        ? params.aiPrediction ?? null
        : params.correctDiagnosis ?? params.aiPrediction ?? null;

    return this.record({
      farmerId: params.farmerId,
      blockId: params.blockId,
      aiSessionId: params.aiSessionId,
      escalationId: params.escalationId,
      recommendationRecordId: params.recommendationRecordId,
      source: 'whatsapp',
      reviewSurface: 'case_review',
      aiPrediction: params.aiPrediction,
      aiConfidence: params.aiConfidence,
      aiTopK: params.aiTopK,
      humanAction: params.action,
      humanFinalLabel,
      correctionReason: params.notesForLearning ?? null,
      confidenceBefore: params.aiConfidence ?? null,
      reviewedBy: params.reviewedBy,
      metadata: {
        corrected: params.action === 'correct_ai' || params.action === 'partial_match',
        approved: params.action === 'approve_ai',
      },
    });
  },

  async recordFromFarmerFeedback(params: {
    farmerId: string;
    aiSessionId?: string | null;
    escalationId?: string | null;
    farmerFeedbackId: string;
    aiPrediction?: string | null;
    aiConfidence?: number | null;
    farmerSuggestedDiagnosis?: string | null;
    decision: FarmerFeedbackDecision;
    agronomistFinalDiagnosis?: string | null;
    agronomistNotes?: string | null;
    confidenceAdjustment?: number | null;
    reviewedBy: string;
  }): Promise<string | null> {
    const humanFinalLabel =
      params.agronomistFinalDiagnosis ??
      (params.decision === 'approved' ? params.farmerSuggestedDiagnosis : null) ??
      params.aiPrediction ??
      null;

    return this.record({
      farmerId: params.farmerId,
      aiSessionId: params.aiSessionId,
      escalationId: params.escalationId,
      farmerFeedbackId: params.farmerFeedbackId,
      source: 'whatsapp',
      reviewSurface: 'farmer_feedback',
      aiPrediction: params.aiPrediction,
      aiConfidence: params.aiConfidence,
      humanAction: params.decision,
      humanFinalLabel,
      correctionReason: params.agronomistNotes ?? null,
      confidenceBefore: params.aiConfidence ?? null,
      confidenceAfter: params.confidenceAdjustment ?? null,
      reviewedBy: params.reviewedBy,
      metadata: {
        farmerSuggested: params.farmerSuggestedDiagnosis ?? null,
      },
    });
  },
};
