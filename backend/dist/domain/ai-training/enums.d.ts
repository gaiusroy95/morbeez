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
export declare const REVIEW_ACTIONS: readonly ["approve_ai", "correct_ai", "partial_match", "escalate_urgent", "reject_recommendation"];
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];
export declare const VISIT_AI_REJECT_REASONS: readonly ["wrong_diagnosis", "need_more_evidence", "recommendation_not_suitable", "custom_recommendation"];
export type VisitAiRejectReason = (typeof VISIT_AI_REJECT_REASONS)[number];
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
/** Block assessment — structured field visit Section 2 */
export declare const BLOCK_HEALTH_LEVELS: readonly ["good", "average", "need_assistance"];
export type BlockHealthLevel = (typeof BLOCK_HEALTH_LEVELS)[number];
export declare const CROP_PERFORMANCE_LEVELS: readonly ["above_expectation", "as_expected", "below_expectation"];
export type CropPerformanceLevel = (typeof CROP_PERFORMANCE_LEVELS)[number];
export declare const SOIL_MOISTURE_LEVELS: readonly ["dry", "optimal", "wet", "waterlogged"];
export type SoilMoistureLevel = (typeof SOIL_MOISTURE_LEVELS)[number];
/** Per-issue lifecycle on a visit */
export declare const ISSUE_STATUSES: readonly ["open", "monitoring", "resolved"];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
/** Issue categories for visit issue cards (maps to FINDING_TYPES where overlapping) */
export declare const ISSUE_CATEGORIES: readonly ["disease", "pest", "nutrient_deficiency", "nutrient_toxicity", "water_stress", "environmental_stress", "soil_problem", "growth_issue", "chemical_injury", "mechanical_damage", "weed", "other"];
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
/** Visit AI question answer types */
export declare const VISIT_AI_ANSWER_TYPES: readonly ["yes_no_unknown", "text", "number"];
export type VisitAiAnswerType = (typeof VISIT_AI_ANSWER_TYPES)[number];
/** Visit AI case lifecycle */
export declare const VISIT_AI_CASE_STATUSES: readonly ["draft", "analyzed", "qa_complete", "recommended", "reviewed", "submitted"];
export type VisitAiCaseStatus = (typeof VISIT_AI_CASE_STATUSES)[number];
/** Recommendation module types */
export declare const RECOMMENDATION_TYPES: readonly ["disease_management", "pest_management", "nutrient_management", "irrigation", "soil_amendment", "monitoring", "other"];
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];
export declare const RECOMMENDATION_PRIORITIES: readonly ["normal", "high", "critical"];
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];
export declare const FIELD_REC_STATUSES: readonly ["open", "monitoring", "completed", "escalated"];
export type FieldRecStatus = (typeof FIELD_REC_STATUSES)[number];
/** Visit follow-up: was recommendation followed? */
export declare const RECOMMENDATION_FOLLOWED: readonly ["yes", "partially", "no", "not_applicable"];
export type RecommendationFollowed = (typeof RECOMMENDATION_FOLLOWED)[number];
/** Visit follow-up outcome (agronomist next-visit review) */
export declare const VISIT_FOLLOWUP_OUTCOMES: readonly ["improved", "no_change", "worsened", "not_reviewed"];
export type VisitFollowupOutcome = (typeof VISIT_FOLLOWUP_OUTCOMES)[number];
//# sourceMappingURL=enums.d.ts.map