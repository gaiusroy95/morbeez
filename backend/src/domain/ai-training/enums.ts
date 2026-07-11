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
  'reject_recommendation',
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const VISIT_AI_REJECT_REASONS = [
  'wrong_diagnosis',
  'need_more_evidence',
  'recommendation_not_suitable',
  'custom_recommendation',
] as const;
export type VisitAiRejectReason = (typeof VISIT_AI_REJECT_REASONS)[number];

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

/** Block assessment — structured field visit Section 2 */
export const BLOCK_HEALTH_LEVELS = ['good', 'average', 'need_assistance'] as const;
export type BlockHealthLevel = (typeof BLOCK_HEALTH_LEVELS)[number];

export const CROP_PERFORMANCE_LEVELS = [
  'above_expectation',
  'as_expected',
  'below_expectation',
] as const;
export type CropPerformanceLevel = (typeof CROP_PERFORMANCE_LEVELS)[number];

export const SOIL_MOISTURE_LEVELS = ['dry', 'optimal', 'wet', 'waterlogged'] as const;
export type SoilMoistureLevel = (typeof SOIL_MOISTURE_LEVELS)[number];

/** Per-issue lifecycle on a visit */
export const ISSUE_STATUSES = ['open', 'monitoring', 'resolved'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Issue categories for visit issue cards (maps to FINDING_TYPES where overlapping) */
export const ISSUE_CATEGORIES = [
  'disease',
  'pest',
  'nutrient_deficiency',
  'nutrient_toxicity',
  'water_stress',
  'environmental_stress',
  'soil_problem',
  'growth_issue',
  'chemical_injury',
  'mechanical_damage',
  'weed',
  'other',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/** Visit AI question answer types (v12 diagnostic engine) */
export const VISIT_AI_ANSWER_TYPES = [
  'yes_no_unknown',
  'yes_no',
  'single_choice',
  'multiple_choice',
  'percentage',
  'number',
  'text',
  'image_upload',
] as const;
export type VisitAiAnswerType = (typeof VISIT_AI_ANSWER_TYPES)[number];

/** Visit AI case lifecycle */
export const VISIT_AI_CASE_STATUSES = [
  'draft',
  'analyzed',
  'qa_complete',
  'recommended',
  'reviewed',
  'submitted',
] as const;
export type VisitAiCaseStatus = (typeof VISIT_AI_CASE_STATUSES)[number];

/** Recommendation module types */
export const RECOMMENDATION_TYPES = [
  'disease_management',
  'pest_management',
  'nutrient_management',
  'irrigation',
  'soil_amendment',
  'monitoring',
  'other',
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_PRIORITIES = ['normal', 'high', 'critical'] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

export const FIELD_REC_STATUSES = ['open', 'monitoring', 'completed', 'escalated'] as const;
export type FieldRecStatus = (typeof FIELD_REC_STATUSES)[number];

/** Visit follow-up: was recommendation followed? */
export const RECOMMENDATION_FOLLOWED = [
  'yes',
  'partially',
  'no',
  'not_applicable',
] as const;
export type RecommendationFollowed = (typeof RECOMMENDATION_FOLLOWED)[number];

/** Visit follow-up outcome (agronomist next-visit review) */
export const VISIT_FOLLOWUP_OUTCOMES = [
  'improved',
  'no_change',
  'worsened',
  'not_reviewed',
] as const;
export type VisitFollowupOutcome = (typeof VISIT_FOLLOWUP_OUTCOMES)[number];
