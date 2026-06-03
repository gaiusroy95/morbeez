import { z } from 'zod';
export declare const findingTypeSchema: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "irrigation", "weather_stress", "growth_observation", "other"]>;
export declare const reviewSeveritySchema: z.ZodEnum<["mild", "moderate", "severe"]>;
export declare const reviewActionSchema: z.ZodEnum<["approve_ai", "correct_ai", "partial_match", "escalate_urgent"]>;
export declare const recommendationOutcomeSchema: z.ZodEnum<["better", "partial", "no_improvement", "unknown"]>;
export declare const farmerFeedbackDecisionSchema: z.ZodEnum<["approved", "rejected", "partial"]>;
export declare const experienceLevelSchema: z.ZodEnum<["beginner", "intermediate", "experienced", "expert"]>;
export declare const farmingStyleSchema: z.ZodEnum<["traditional", "semi_commercial", "commercial", "organic", "mixed"]>;
export declare const imageReviewActionSchema: z.ZodEnum<["confirm_ai", "correct_ai", "skip", "exclude"]>;
/** Image review submission */
export declare const imageReviewBodySchema: z.ZodEffects<z.ZodObject<{
    action: z.ZodEnum<["confirm_ai", "correct_ai", "skip", "exclude"]>;
    agronomistLabel: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<["mild", "moderate", "severe"]>>;
    reviewNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "correct_ai" | "confirm_ai" | "skip" | "exclude";
    severity?: "mild" | "moderate" | "severe" | undefined;
    agronomistLabel?: string | undefined;
    reviewNotes?: string | undefined;
}, {
    action: "correct_ai" | "confirm_ai" | "skip" | "exclude";
    severity?: "mild" | "moderate" | "severe" | undefined;
    agronomistLabel?: string | undefined;
    reviewNotes?: string | undefined;
}>, {
    action: "correct_ai" | "confirm_ai" | "skip" | "exclude";
    severity?: "mild" | "moderate" | "severe" | undefined;
    agronomistLabel?: string | undefined;
    reviewNotes?: string | undefined;
}, {
    action: "correct_ai" | "confirm_ai" | "skip" | "exclude";
    severity?: "mild" | "moderate" | "severe" | undefined;
    agronomistLabel?: string | undefined;
    reviewNotes?: string | undefined;
}>;
/** Structured field finding payload — used by telecaller/agronomist APIs (Stage 1+) */
export declare const structuredFieldFindingSchema: z.ZodObject<{
    findingType: z.ZodOptional<z.ZodEnum<["disease", "pest", "nutrient_deficiency", "irrigation", "weather_stress", "growth_observation", "other"]>>;
    severity: z.ZodOptional<z.ZodEnum<["mild", "moderate", "severe"]>>;
    affectedAreaPct: z.ZodOptional<z.ZodNumber>;
    aiPrediction: z.ZodOptional<z.ZodString>;
    finalConfirmedIssue: z.ZodOptional<z.ZodString>;
    weatherContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    severity?: "mild" | "moderate" | "severe" | undefined;
    weatherContext?: Record<string, unknown> | undefined;
    findingType?: "disease" | "pest" | "nutrient_deficiency" | "irrigation" | "weather_stress" | "growth_observation" | "other" | undefined;
    affectedAreaPct?: number | undefined;
    aiPrediction?: string | undefined;
    finalConfirmedIssue?: string | undefined;
}, {
    severity?: "mild" | "moderate" | "severe" | undefined;
    weatherContext?: Record<string, unknown> | undefined;
    findingType?: "disease" | "pest" | "nutrient_deficiency" | "irrigation" | "weather_stress" | "growth_observation" | "other" | undefined;
    affectedAreaPct?: number | undefined;
    aiPrediction?: string | undefined;
    finalConfirmedIssue?: string | undefined;
}>;
/** Max WhatsApp recommendation body (agronomist case review). DB is TEXT; outbound WhatsApp capped separately. */
export declare const CASE_REVIEW_RECOMMENDATION_TEXT_MAX = 8000;
/** Case review submission */
export declare const caseReviewBodySchema: z.ZodObject<{
    action: z.ZodEnum<["approve_ai", "correct_ai", "partial_match", "escalate_urgent"]>;
    correctDiagnosis: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<["mild", "moderate", "severe"]>>;
    recommendationText: z.ZodOptional<z.ZodString>;
    dosage: z.ZodOptional<z.ZodString>;
    notesForLearning: z.ZodOptional<z.ZodString>;
    submitForApproval: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent";
    severity?: "mild" | "moderate" | "severe" | undefined;
    correctDiagnosis?: string | undefined;
    dosage?: string | undefined;
    recommendationText?: string | undefined;
    notesForLearning?: string | undefined;
    submitForApproval?: boolean | undefined;
}, {
    action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent";
    severity?: "mild" | "moderate" | "severe" | undefined;
    correctDiagnosis?: string | undefined;
    dosage?: string | undefined;
    recommendationText?: string | undefined;
    notesForLearning?: string | undefined;
    submitForApproval?: boolean | undefined;
}>;
/** Outcome recording — agronomist outcome review (Stage 5) */
export declare const recordOutcomeBodySchema: z.ZodObject<{
    outcome: z.ZodEnum<["better", "partial", "no_improvement", "unknown"]>;
    notes: z.ZodOptional<z.ZodString>;
    recoveryDays: z.ZodOptional<z.ZodNumber>;
    farmerFeedback: z.ZodOptional<z.ZodString>;
    agronomistFeedback: z.ZodOptional<z.ZodString>;
    issueResolved: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    outcome: "better" | "unknown" | "partial" | "no_improvement";
    notes?: string | undefined;
    issueResolved?: boolean | undefined;
    recoveryDays?: number | undefined;
    farmerFeedback?: string | undefined;
    agronomistFeedback?: string | undefined;
}, {
    outcome: "better" | "unknown" | "partial" | "no_improvement";
    notes?: string | undefined;
    issueResolved?: boolean | undefined;
    recoveryDays?: number | undefined;
    farmerFeedback?: string | undefined;
    agronomistFeedback?: string | undefined;
}>;
//# sourceMappingURL=validators.d.ts.map