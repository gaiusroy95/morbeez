/**
 * Canonical enums for AI training data — single source of truth.
 * DB CHECK constraints and API validators must align with these values.
 */

/** Field finding classification */
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

/** UI / agronomist review severity (mild → severe) */
export const REVIEW_SEVERITIES = ['mild', 'moderate', 'severe'] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

/** DB storage severity (low → high) — used on recommendation_records, ai_advisory_sessions */
export const RECORD_SEVERITIES = ['low', 'medium', 'high'] as const;
export type RecordSeverity = (typeof RECORD_SEVERITIES)[number];

/** Recommendation / cultivation / field activity outcome */
export const RECOMMENDATION_OUTCOMES = ['better', 'partial', 'no_improvement', 'unknown'] as const;
export type RecommendationOutcome = (typeof RECOMMENDATION_OUTCOMES)[number];

/** WhatsApp follow-up outcome replies (maps to RecommendationOutcome) */
export const FOLLOWUP_OUTCOMES = ['improved', 'partial', 'no_improvement', 'worsened'] as const;
export type FollowupOutcome = (typeof FOLLOWUP_OUTCOMES)[number];

/** Agronomist case review actions */
export const REVIEW_ACTIONS = [
  'approve_ai',
  'correct_ai',
  'partial_match',
  'escalate_urgent',
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/** Farmer feedback review decisions */
export const FARMER_FEEDBACK_DECISIONS = ['approved', 'rejected', 'partial'] as const;
export type FarmerFeedbackDecision = (typeof FARMER_FEEDBACK_DECISIONS)[number];

/**
 * Confidence routing band — determines auto-send vs review vs escalate.
 * Thresholds configured via AI_AUTO_SEND_THRESHOLD / AI_REVIEW_THRESHOLD env vars.
 */
export const CONFIDENCE_ACTIONS = ['auto_send', 'employee_review', 'escalate'] as const;
export type ConfidenceAction = (typeof CONFIDENCE_ACTIONS)[number];

/** Legacy policy-engine band (high/medium/low) — retained for crop health scoring */
export const POLICY_CONFIDENCE_BANDS = ['high', 'medium', 'low'] as const;
export type PolicyConfidenceBand = (typeof POLICY_CONFIDENCE_BANDS)[number];

/** Farmer experience level for regional pattern learning */
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'experienced', 'expert'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Farming style classification */
export const FARMING_STYLES = [
  'traditional',
  'semi_commercial',
  'commercial',
  'organic',
  'mixed',
] as const;
export type FarmingStyle = (typeof FARMING_STYLES)[number];

/** AI session lifecycle flags (Stage 4 will persist these on ai_advisory_sessions) */
export const AI_SESSION_REVIEW_STATUSES = [
  'pending',
  'auto_sent',
  'employee_reviewed',
  'agronomist_reviewed',
  'corrected',
  'escalated',
] as const;
export type AiSessionReviewStatus = (typeof AI_SESSION_REVIEW_STATUSES)[number];

/** Training event source channels */
export const TRAINING_EVENT_SOURCES = ['whatsapp', 'field_visit', 'crm', 'api'] as const;
export type TrainingEventSource = (typeof TRAINING_EVENT_SOURCES)[number];

/** Image review status for labeled dataset (Stage 3) */
export const IMAGE_REVIEW_STATUSES = ['pending', 'reviewed', 'skipped', 'excluded'] as const;
export type ImageReviewStatus = (typeof IMAGE_REVIEW_STATUSES)[number];

/** Image review actions */
export const IMAGE_REVIEW_ACTIONS = ['confirm_ai', 'correct_ai', 'skip', 'exclude'] as const;
export type ImageReviewAction = (typeof IMAGE_REVIEW_ACTIONS)[number];
