import { z } from 'zod';
import {
  FINDING_TYPES,
  REVIEW_ACTIONS,
  REVIEW_SEVERITIES,
  RECOMMENDATION_OUTCOMES,
  FARMER_FEEDBACK_DECISIONS,
  EXPERIENCE_LEVELS,
  FARMING_STYLES,
  IMAGE_REVIEW_ACTIONS,
  BLOCK_HEALTH_LEVELS,
  CROP_PERFORMANCE_LEVELS,
  SOIL_MOISTURE_LEVELS,
  ISSUE_STATUSES,
  ISSUE_CATEGORIES,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_PRIORITIES,
  FIELD_REC_STATUSES,
  RECOMMENDATION_FOLLOWED,
  VISIT_FOLLOWUP_OUTCOMES,
  RECORD_SEVERITIES,
  VISIT_AI_REJECT_REASONS,
} from './enums.js';

export const findingTypeSchema = z.enum(FINDING_TYPES);
export const reviewSeveritySchema = z.enum(REVIEW_SEVERITIES);
export const reviewActionSchema = z.enum(REVIEW_ACTIONS);
export const recommendationOutcomeSchema = z.enum(RECOMMENDATION_OUTCOMES);
export const farmerFeedbackDecisionSchema = z.enum(FARMER_FEEDBACK_DECISIONS);
export const experienceLevelSchema = z.enum(EXPERIENCE_LEVELS);
export const farmingStyleSchema = z.enum(FARMING_STYLES);
export const imageReviewActionSchema = z.enum(IMAGE_REVIEW_ACTIONS);

/** Image review submission */
export const imageReviewBodySchema = z
  .object({
    action: imageReviewActionSchema,
    agronomistLabel: z.string().max(200).optional(),
    severity: reviewSeveritySchema.optional(),
    reviewNotes: z.string().max(1000).optional(),
  })
  .refine(
    (data) =>
      data.action !== 'correct_ai' || Boolean(data.agronomistLabel?.trim()),
    { message: 'agronomistLabel is required when correcting AI', path: ['agronomistLabel'] }
  );

/** Structured field finding payload — used by telecaller/agronomist APIs (Stage 1+) */
export const structuredFieldFindingSchema = z.object({
  findingType: findingTypeSchema.optional(),
  severity: reviewSeveritySchema.optional(),
  affectedAreaPct: z.number().min(0).max(100).optional(),
  aiPrediction: z.string().max(200).optional(),
  finalConfirmedIssue: z.string().max(200).optional(),
  weatherContext: z.record(z.unknown()).optional(),
});

/** Max WhatsApp recommendation body (agronomist case review). DB is TEXT; outbound WhatsApp capped separately. */
export const CASE_REVIEW_RECOMMENDATION_TEXT_MAX = 8000;

/** Case review submission */
export const caseReviewBodySchema = z.object({
  action: reviewActionSchema,
  correctDiagnosis: z.string().max(200).optional(),
  severity: reviewSeveritySchema.optional(),
  recommendationText: z.string().max(CASE_REVIEW_RECOMMENDATION_TEXT_MAX).optional(),
  dosage: z.string().max(2000).optional(),
  notesForLearning: z.string().max(1000).optional(),
  submitForApproval: z.boolean().optional(),
});

/** Outcome recording — agronomist outcome review (Stage 5) */
export const recordOutcomeBodySchema = z.object({
  outcome: recommendationOutcomeSchema,
  notes: z.string().max(1000).optional(),
  recoveryDays: z.number().int().min(0).max(365).optional(),
  farmerFeedback: z.string().max(2000).optional(),
  agronomistFeedback: z.string().max(2000).optional(),
  issueResolved: z.boolean().optional(),
});

export const blockHealthSchema = z.enum(BLOCK_HEALTH_LEVELS);
export const cropPerformanceSchema = z.enum(CROP_PERFORMANCE_LEVELS);
export const soilMoistureSchema = z.enum(SOIL_MOISTURE_LEVELS);
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export const issueCategorySchema = z.enum(ISSUE_CATEGORIES);
export const recommendationTypeSchema = z.enum(RECOMMENDATION_TYPES);
export const recommendationPrioritySchema = z.enum(RECOMMENDATION_PRIORITIES);
export const fieldRecStatusSchema = z.enum(FIELD_REC_STATUSES);
export const recommendationFollowedSchema = z.enum(RECOMMENDATION_FOLLOWED);
export const visitFollowupOutcomeSchema = z.enum(VISIT_FOLLOWUP_OUTCOMES);
export const recordSeveritySchema = z.enum(RECORD_SEVERITIES);

const visitPhotoSchema = z.object({
  filename: z.string().max(200),
  mimeType: z.string().max(100),
  dataBase64: z.string().max(12_000_000),
  photoType: z.string().max(80).optional(),
});

export const agronomistReviewSchema = z.object({
  action: reviewActionSchema,
  finalDiagnosis: z.string().max(200).optional(),
  finalRecommendation: z.string().max(8000).optional(),
  modificationReason: z.string().max(1000).optional(),
  agronomistConfidence: z.number().min(0).max(1).optional(),
  yieldRisk: z.string().max(200).optional(),
  rejectReason: z.enum(VISIT_AI_REJECT_REASONS).optional(),
  rejectNote: z.string().max(1000).optional(),
  correctedDiagnosis: z.string().max(200).optional(),
  evidenceRequest: z
    .object({
      photoTypes: z.array(z.string().max(80)).max(10),
      questions: z.array(
        z.object({
          key: z.string().max(80),
          text: z.string().max(500),
          answer: z.string().max(200).optional(),
        })
      ),
    })
    .optional(),
  customRecommendation: z
    .object({
      product: z.string().max(200),
      dose: z.string().max(200),
      method: z.string().max(500),
      reviewDate: z.string().max(40).optional(),
    })
    .optional(),
  rejectFlowComplete: z.boolean().optional(),
});

const visitIssueRecommendationSchema = z.object({
  recommendationType: recommendationTypeSchema.optional(),
  priority: recommendationPrioritySchema.optional(),
  text: z.string().min(1).max(8000),
  reviewAfterDays: z.number().int().min(1).max(365).optional(),
  reviewDate: z.string().datetime().optional(),
  status: fieldRecStatusSchema.optional(),
});

export const visitIssueInputSchema = z.object({
  category: issueCategorySchema,
  issueMasterId: z.string().uuid().optional(),
  issueName: z.string().min(1).max(200),
  severity: recordSeveritySchema,
  observation: z.string().max(4000).optional(),
  status: issueStatusSchema.optional(),
  photos: z.array(visitPhotoSchema).max(8).optional(),
  aiCaseId: z.string().uuid().optional(),
  agronomistReview: agronomistReviewSchema.optional(),
  finalDiagnosis: z.string().max(200).optional(),
  finalRecommendation: z.string().max(8000).optional(),
  reviewAfterDays: z.number().int().min(1).max(365).optional(),
  recommendations: z.array(visitIssueRecommendationSchema).max(5).optional(),
});

export const visitMeasurementInputSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.string().min(1).max(200),
  unit: z.string().max(40).optional(),
});

export const visitFollowUpInputSchema = z.object({
  recommendationId: z.string().uuid(),
  followed: recommendationFollowedSchema,
  outcome: visitFollowupOutcomeSchema,
  notes: z.string().max(2000).optional(),
});

/** Structured multi-issue field visit — POST /os/field/visits/v2 */
export const structuredFieldVisitSchema = z.object({
  farmerId: z.string().uuid(),
  blockId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  visitedAt: z.string().datetime().optional(),
  blockAssessment: z
    .object({
      blockHealth: blockHealthSchema,
      cropPerformance: cropPerformanceSchema,
      soilMoisture: soilMoistureSchema,
    })
    .optional(),
  measurements: z.array(visitMeasurementInputSchema).max(20).optional(),
  visitPhotos: z.array(visitPhotoSchema).max(12).optional(),
  issues: z.array(visitIssueInputSchema).min(1).max(12),
  followUps: z.array(visitFollowUpInputSchema).max(20).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  sendVisitSummary: z.boolean().optional(),
});

export const visitAiContextRequestSchema = z.object({
  farmerId: z.string().uuid(),
  blockId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  blockAssessment: z
    .object({
      blockHealth: blockHealthSchema,
      cropPerformance: cropPerformanceSchema,
      soilMoisture: soilMoistureSchema,
    })
    .optional(),
  measurements: z.array(visitMeasurementInputSchema).max(20).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const visitAnalyzeRequestSchema = visitAiContextRequestSchema.extend({
  issueCategory: issueCategorySchema,
  issueName: z.string().min(1).max(200),
  observation: z.string().max(4000).optional(),
  photoRefs: z.array(z.string().max(500)).max(8).optional(),
  analyzePhotos: z
    .array(
      z.object({
        dataBase64: z.string().min(100).max(12_000_000),
        mimeType: z.string().max(100).optional(),
      })
    )
    .max(4)
    .optional(),
  selectedHypothesisLabel: z.string().max(200).optional(),
});

export const visitAiAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().max(500),
});

export const visitAiAnswersBodySchema = z.object({
  answers: z.array(visitAiAnswerSchema).min(1).max(20),
});

export const visitAiRecommendBodySchema = z.object({
  finalDiagnosis: z.string().max(200).optional(),
});

export const visitAiRejectBodySchema = z
  .object({
    reason: z.enum(VISIT_AI_REJECT_REASONS),
    correctedDiagnosis: z.string().max(200).optional(),
    rejectNote: z.string().max(1000).optional(),
    editedRecommendation: z.string().max(8000).optional(),
    evidenceRequest: z
      .object({
        photoTypes: z.array(z.string().max(80)).min(1).max(10),
        questions: z.array(
          z.object({
            key: z.string().max(80),
            text: z.string().max(500),
            answer: z.string().max(200),
          })
        ),
      })
      .optional(),
    customRecommendation: z
      .object({
        product: z.string().min(1).max(200),
        dose: z.string().min(1).max(200),
        method: z.string().min(1).max(500),
        reviewDate: z.string().max(40).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === 'wrong_diagnosis' && !data.correctedDiagnosis?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'correctedDiagnosis required', path: ['correctedDiagnosis'] });
    }
    if (data.reason === 'need_more_evidence' && !data.evidenceRequest) {
      ctx.addIssue({ code: 'custom', message: 'evidenceRequest required', path: ['evidenceRequest'] });
    }
    if (data.reason === 'recommendation_not_suitable') {
      if (!data.rejectNote?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'rejectNote required', path: ['rejectNote'] });
      }
      if (!data.editedRecommendation?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'editedRecommendation required', path: ['editedRecommendation'] });
      }
    }
    if (data.reason === 'custom_recommendation' && !data.customRecommendation) {
      ctx.addIssue({ code: 'custom', message: 'customRecommendation required', path: ['customRecommendation'] });
    }
  });

export type StructuredFieldVisitInput = z.infer<typeof structuredFieldVisitSchema>;
export type VisitAnalyzeRequest = z.infer<typeof visitAnalyzeRequestSchema>;
export type VisitAiAnswersBody = z.infer<typeof visitAiAnswersBodySchema>;
export type VisitAiRejectBody = z.infer<typeof visitAiRejectBodySchema>;
