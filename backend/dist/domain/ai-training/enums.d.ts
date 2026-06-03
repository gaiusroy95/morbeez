/**
 * Canonical enums for AI training data — single source of truth.
 * DB CHECK constraints and API validators must align with these values.
 */
/** Field finding classification */
export declare const FINDING_TYPES: readonly ["disease", "pest", "nutrient_deficiency", "irrigation", "weather_stress", "growth_observation", "other"];
export type FindingType = (typeof FINDING_TYPES)[number];
/** UI / agronomist review severity (mild → severe) */
export declare const REVIEW_SEVERITIES: readonly ["mild", "moderate", "severe"];
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];
/** DB storage severity (low → high) — used on recommendation_records, ai_advisory_sessions */
export declare const RECORD_SEVERITIES: readonly ["low", "medium", "high"];
export type RecordSeverity = (typeof RECORD_SEVERITIES)[number];
/** Recommendation / cultivation / field activity outcome */
export declare const RECOMMENDATION_OUTCOMES: readonly ["better", "partial", "no_improvement", "unknown"];
export type RecommendationOutcome = (typeof RECOMMENDATION_OUTCOMES)[number];
/** WhatsApp follow-up outcome replies (maps to RecommendationOutcome) */
export declare const FOLLOWUP_OUTCOMES: readonly ["improved", "partial", "no_improvement", "worsened"];
export type FollowupOutcome = (typeof FOLLOWUP_OUTCOMES)[number];
/** Agronomist case review actions */
export declare const REVIEW_ACTIONS: readonly ["approve_ai", "correct_ai", "partial_match", "escalate_urgent"];
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];
/** Farmer feedback review decisions */
export declare const FARMER_FEEDBACK_DECISIONS: readonly ["approved", "rejected", "partial"];
export type FarmerFeedbackDecision = (typeof FARMER_FEEDBACK_DECISIONS)[number];
/**
 * Confidence routing band — determines auto-send vs review vs escalate.
 * Thresholds configured via AI_AUTO_SEND_THRESHOLD / AI_REVIEW_THRESHOLD env vars.
 */
export declare const CONFIDENCE_ACTIONS: readonly ["auto_send", "employee_review", "escalate"];
export type ConfidenceAction = (typeof CONFIDENCE_ACTIONS)[number];
/** Legacy policy-engine band (high/medium/low) — retained for crop health scoring */
export declare const POLICY_CONFIDENCE_BANDS: readonly ["high", "medium", "low"];
export type PolicyConfidenceBand = (typeof POLICY_CONFIDENCE_BANDS)[number];
/** Farmer experience level for regional pattern learning */
export declare const EXPERIENCE_LEVELS: readonly ["beginner", "intermediate", "experienced", "expert"];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
/** Farming style classification */
export declare const FARMING_STYLES: readonly ["traditional", "semi_commercial", "commercial", "organic", "mixed"];
export type FarmingStyle = (typeof FARMING_STYLES)[number];
/** AI session lifecycle flags (Stage 4 will persist these on ai_advisory_sessions) */
export declare const AI_SESSION_REVIEW_STATUSES: readonly ["pending", "auto_sent", "employee_reviewed", "agronomist_reviewed", "corrected", "escalated"];
export type AiSessionReviewStatus = (typeof AI_SESSION_REVIEW_STATUSES)[number];
/** Training event source channels */
export declare const TRAINING_EVENT_SOURCES: readonly ["whatsapp", "field_visit", "crm", "api"];
export type TrainingEventSource = (typeof TRAINING_EVENT_SOURCES)[number];
/** Image review status for labeled dataset (Stage 3) */
export declare const IMAGE_REVIEW_STATUSES: readonly ["pending", "reviewed", "skipped", "excluded"];
export type ImageReviewStatus = (typeof IMAGE_REVIEW_STATUSES)[number];
/** Image review actions */
export declare const IMAGE_REVIEW_ACTIONS: readonly ["confirm_ai", "correct_ai", "skip", "exclude"];
export type ImageReviewAction = (typeof IMAGE_REVIEW_ACTIONS)[number];
//# sourceMappingURL=enums.d.ts.map