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
];
/** UI / agronomist review severity (mild → severe) */
export const REVIEW_SEVERITIES = ['mild', 'moderate', 'severe'];
/** DB storage severity (low → high) — used on recommendation_records, ai_advisory_sessions */
export const RECORD_SEVERITIES = ['low', 'medium', 'high'];
/** Recommendation / cultivation / field activity outcome */
export const RECOMMENDATION_OUTCOMES = ['better', 'partial', 'no_improvement', 'unknown'];
/** WhatsApp follow-up outcome replies (maps to RecommendationOutcome) */
export const FOLLOWUP_OUTCOMES = ['improved', 'partial', 'no_improvement', 'worsened'];
/** Agronomist case review actions */
export const REVIEW_ACTIONS = [
    'approve_ai',
    'correct_ai',
    'partial_match',
    'escalate_urgent',
];
/** Farmer feedback review decisions */
export const FARMER_FEEDBACK_DECISIONS = ['approved', 'rejected', 'partial'];
/**
 * Confidence routing band — determines auto-send vs review vs escalate.
 * Thresholds configured via AI_AUTO_SEND_THRESHOLD / AI_REVIEW_THRESHOLD env vars.
 */
export const CONFIDENCE_ACTIONS = ['auto_send', 'employee_review', 'escalate'];
/** Legacy policy-engine band (high/medium/low) — retained for crop health scoring */
export const POLICY_CONFIDENCE_BANDS = ['high', 'medium', 'low'];
/** Farmer experience level for regional pattern learning */
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'experienced', 'expert'];
/** Farming style classification */
export const FARMING_STYLES = [
    'traditional',
    'semi_commercial',
    'commercial',
    'organic',
    'mixed',
];
/** AI session lifecycle flags (Stage 4 will persist these on ai_advisory_sessions) */
export const AI_SESSION_REVIEW_STATUSES = [
    'pending',
    'auto_sent',
    'employee_reviewed',
    'agronomist_reviewed',
    'corrected',
    'escalated',
];
/** Training event source channels */
export const TRAINING_EVENT_SOURCES = ['whatsapp', 'field_visit', 'crm', 'api'];
/** Image review status for labeled dataset (Stage 3) */
export const IMAGE_REVIEW_STATUSES = ['pending', 'reviewed', 'skipped', 'excluded'];
/** Image review actions */
export const IMAGE_REVIEW_ACTIONS = ['confirm_ai', 'correct_ai', 'skip', 'exclude'];
//# sourceMappingURL=enums.js.map