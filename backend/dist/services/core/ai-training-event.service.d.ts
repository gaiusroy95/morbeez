import type { ReviewAction, FarmerFeedbackDecision, ImageReviewAction } from '../../domain/ai-training/enums.js';
export type TrainingReviewSurface = 'case_review' | 'farmer_feedback' | 'telecaller_escalation' | 'field_finding' | 'image_review';
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
    aiTopK?: Array<{
        label: string;
        confidence?: number | null;
    }>;
    humanAction: TrainingHumanAction;
    humanFinalLabel?: string | null;
    correctionReason?: string | null;
    confidenceBefore?: number | null;
    confidenceAfter?: number | null;
    reviewedBy: string;
    metadata?: Record<string, unknown>;
};
export declare const aiTrainingEventService: {
    record(input: RecordTrainingEventInput): Promise<string | null>;
    recordFromCaseReview(params: {
        farmerId: string;
        blockId?: string | null;
        aiSessionId?: string | null;
        escalationId: string;
        recommendationRecordId?: string | null;
        aiPrediction?: string | null;
        aiConfidence?: number | null;
        aiTopK?: Array<{
            label: string;
            confidence?: number | null;
        }>;
        action: ReviewAction;
        correctDiagnosis?: string | null;
        notesForLearning?: string | null;
        reviewedBy: string;
    }): Promise<string | null>;
    recordFromFarmerFeedback(params: {
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
    }): Promise<string | null>;
};
//# sourceMappingURL=ai-training-event.service.d.ts.map