/**
 * Frontend mirror of backend/src/domain/ai-training/enums.ts
 * Keep in sync when adding new training enums.
 */

export const FINDING_TYPES = [
  'disease',
  'pest',
  'nutrient_deficiency',
  'irrigation',
  'weather_stress',
  'growth_observation',
  'other',
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const REVIEW_SEVERITIES = ['mild', 'moderate', 'severe'] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

export const REVIEW_ACTIONS = [
  'approve_ai',
  'correct_ai',
  'partial_match',
  'escalate_urgent',
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const RECOMMENDATION_OUTCOMES = ['better', 'partial', 'no_improvement', 'unknown'] as const;
export type RecommendationOutcome = (typeof RECOMMENDATION_OUTCOMES)[number];

export const RECOMMENDATION_OUTCOME_LABELS: Record<RecommendationOutcome, string> = {
  better: 'Resolved — crop improved',
  partial: 'Partial improvement',
  no_improvement: 'No improvement',
  unknown: 'Unknown / too early',
};

export const CONFIDENCE_ACTIONS = ['auto_send', 'employee_review', 'escalate'] as const;
export type ConfidenceAction = (typeof CONFIDENCE_ACTIONS)[number];

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'experienced', 'expert'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const FARMING_STYLES = [
  'traditional',
  'semi_commercial',
  'commercial',
  'organic',
  'mixed',
] as const;
export type FarmingStyle = (typeof FARMING_STYLES)[number];

export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  disease: 'Disease',
  pest: 'Pest',
  nutrient_deficiency: 'Nutrient deficiency',
  irrigation: 'Irrigation',
  weather_stress: 'Weather stress',
  growth_observation: 'Growth observation',
  other: 'Other',
};

export const REVIEW_SEVERITY_LABELS: Record<ReviewSeverity, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

export const CONFIDENCE_ACTION_LABELS: Record<ConfidenceAction, string> = {
  auto_send: 'Auto-send (≥95%)',
  employee_review: 'Employee review (80–94%)',
  escalate: 'Escalate (<80%)',
};

export const IMAGE_REVIEW_STATUSES = ['pending', 'reviewed', 'skipped', 'excluded'] as const;
export type ImageReviewStatus = (typeof IMAGE_REVIEW_STATUSES)[number];

export const IMAGE_REVIEW_ACTIONS = ['confirm_ai', 'correct_ai', 'skip', 'exclude'] as const;
export type ImageReviewAction = (typeof IMAGE_REVIEW_ACTIONS)[number];

export const TRAINING_EVENT_TYPES = [
  'correct_ai',
  'partial_correct',
  'wrong_recommendation',
  'false_positive',
] as const;
export type TrainingEventType = (typeof TRAINING_EVENT_TYPES)[number];

export const TRAINING_EVENT_TYPE_LABELS: Record<TrainingEventType, string> = {
  correct_ai: 'Correct AI',
  partial_correct: 'Partial correct',
  wrong_recommendation: 'Wrong recommendation',
  false_positive: 'False positive',
};
