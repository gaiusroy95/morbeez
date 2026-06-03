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

/** Case review submission */
export const caseReviewBodySchema = z.object({
  action: reviewActionSchema,
  correctDiagnosis: z.string().max(200).optional(),
  severity: reviewSeveritySchema.optional(),
  recommendationText: z.string().max(2000).optional(),
  dosage: z.string().max(500).optional(),
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
