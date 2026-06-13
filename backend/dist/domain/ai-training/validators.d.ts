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
export declare const blockHealthSchema: z.ZodEnum<["good", "average", "need_assistance"]>;
export declare const cropPerformanceSchema: z.ZodEnum<["above_expectation", "as_expected", "below_expectation"]>;
export declare const soilMoistureSchema: z.ZodEnum<["dry", "optimal", "wet", "waterlogged"]>;
export declare const issueStatusSchema: z.ZodEnum<["open", "monitoring", "resolved"]>;
export declare const issueCategorySchema: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "water_stress", "weed", "other"]>;
export declare const recommendationTypeSchema: z.ZodEnum<["disease_management", "pest_management", "nutrient_management", "irrigation", "soil_amendment", "monitoring", "other"]>;
export declare const recommendationPrioritySchema: z.ZodEnum<["normal", "high", "critical"]>;
export declare const fieldRecStatusSchema: z.ZodEnum<["open", "monitoring", "completed", "escalated"]>;
export declare const recommendationFollowedSchema: z.ZodEnum<["yes", "partially", "no", "not_applicable"]>;
export declare const visitFollowupOutcomeSchema: z.ZodEnum<["improved", "no_change", "worsened", "not_reviewed"]>;
export declare const recordSeveritySchema: z.ZodEnum<["low", "medium", "high"]>;
export declare const visitIssueInputSchema: z.ZodObject<{
    category: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "water_stress", "weed", "other"]>;
    issueMasterId: z.ZodOptional<z.ZodString>;
    issueName: z.ZodString;
    severity: z.ZodEnum<["low", "medium", "high"]>;
    observation: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["open", "monitoring", "resolved"]>>;
    photos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        mimeType: z.ZodString;
        dataBase64: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        mimeType: string;
        filename: string;
        dataBase64: string;
    }, {
        mimeType: string;
        filename: string;
        dataBase64: string;
    }>, "many">>;
    recommendations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        recommendationType: z.ZodOptional<z.ZodEnum<["disease_management", "pest_management", "nutrient_management", "irrigation", "soil_amendment", "monitoring", "other"]>>;
        priority: z.ZodOptional<z.ZodEnum<["normal", "high", "critical"]>>;
        text: z.ZodString;
        reviewAfterDays: z.ZodOptional<z.ZodNumber>;
        reviewDate: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["open", "monitoring", "completed", "escalated"]>>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
        priority?: "high" | "normal" | "critical" | undefined;
        recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
        reviewAfterDays?: number | undefined;
        reviewDate?: string | undefined;
    }, {
        text: string;
        status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
        priority?: "high" | "normal" | "critical" | undefined;
        recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
        reviewAfterDays?: number | undefined;
        reviewDate?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    category: "disease" | "pest" | "nutrient_deficiency" | "other" | "water_stress" | "weed";
    severity: "low" | "medium" | "high";
    issueName: string;
    status?: "open" | "monitoring" | "resolved" | undefined;
    observation?: string | undefined;
    recommendations?: {
        text: string;
        status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
        priority?: "high" | "normal" | "critical" | undefined;
        recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
        reviewAfterDays?: number | undefined;
        reviewDate?: string | undefined;
    }[] | undefined;
    issueMasterId?: string | undefined;
    photos?: {
        mimeType: string;
        filename: string;
        dataBase64: string;
    }[] | undefined;
}, {
    category: "disease" | "pest" | "nutrient_deficiency" | "other" | "water_stress" | "weed";
    severity: "low" | "medium" | "high";
    issueName: string;
    status?: "open" | "monitoring" | "resolved" | undefined;
    observation?: string | undefined;
    recommendations?: {
        text: string;
        status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
        priority?: "high" | "normal" | "critical" | undefined;
        recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
        reviewAfterDays?: number | undefined;
        reviewDate?: string | undefined;
    }[] | undefined;
    issueMasterId?: string | undefined;
    photos?: {
        mimeType: string;
        filename: string;
        dataBase64: string;
    }[] | undefined;
}>;
export declare const visitMeasurementInputSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodString;
    unit: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    key: string;
    unit?: string | undefined;
}, {
    value: string;
    key: string;
    unit?: string | undefined;
}>;
export declare const visitFollowUpInputSchema: z.ZodObject<{
    recommendationId: z.ZodString;
    followed: z.ZodEnum<["yes", "partially", "no", "not_applicable"]>;
    outcome: z.ZodEnum<["improved", "no_change", "worsened", "not_reviewed"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    outcome: "improved" | "worsened" | "no_change" | "not_reviewed";
    recommendationId: string;
    followed: "yes" | "partially" | "no" | "not_applicable";
    notes?: string | undefined;
}, {
    outcome: "improved" | "worsened" | "no_change" | "not_reviewed";
    recommendationId: string;
    followed: "yes" | "partially" | "no" | "not_applicable";
    notes?: string | undefined;
}>;
/** Structured multi-issue field visit — POST /os/field/visits/v2 */
export declare const structuredFieldVisitSchema: z.ZodObject<{
    farmerId: z.ZodString;
    blockId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    leadId: z.ZodOptional<z.ZodString>;
    visitedAt: z.ZodOptional<z.ZodString>;
    blockAssessment: z.ZodOptional<z.ZodObject<{
        blockHealth: z.ZodEnum<["good", "average", "need_assistance"]>;
        cropPerformance: z.ZodEnum<["above_expectation", "as_expected", "below_expectation"]>;
        soilMoisture: z.ZodEnum<["dry", "optimal", "wet", "waterlogged"]>;
    }, "strip", z.ZodTypeAny, {
        blockHealth: "good" | "average" | "need_assistance";
        cropPerformance: "above_expectation" | "as_expected" | "below_expectation";
        soilMoisture: "dry" | "optimal" | "wet" | "waterlogged";
    }, {
        blockHealth: "good" | "average" | "need_assistance";
        cropPerformance: "above_expectation" | "as_expected" | "below_expectation";
        soilMoisture: "dry" | "optimal" | "wet" | "waterlogged";
    }>>;
    measurements: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
        unit: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
        unit?: string | undefined;
    }, {
        value: string;
        key: string;
        unit?: string | undefined;
    }>, "many">>;
    issues: z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "water_stress", "weed", "other"]>;
        issueMasterId: z.ZodOptional<z.ZodString>;
        issueName: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high"]>;
        observation: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["open", "monitoring", "resolved"]>>;
        photos: z.ZodOptional<z.ZodArray<z.ZodObject<{
            filename: z.ZodString;
            mimeType: z.ZodString;
            dataBase64: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            mimeType: string;
            filename: string;
            dataBase64: string;
        }, {
            mimeType: string;
            filename: string;
            dataBase64: string;
        }>, "many">>;
        recommendations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            recommendationType: z.ZodOptional<z.ZodEnum<["disease_management", "pest_management", "nutrient_management", "irrigation", "soil_amendment", "monitoring", "other"]>>;
            priority: z.ZodOptional<z.ZodEnum<["normal", "high", "critical"]>>;
            text: z.ZodString;
            reviewAfterDays: z.ZodOptional<z.ZodNumber>;
            reviewDate: z.ZodOptional<z.ZodString>;
            status: z.ZodOptional<z.ZodEnum<["open", "monitoring", "completed", "escalated"]>>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
            reviewDate?: string | undefined;
        }, {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
            reviewDate?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        category: "disease" | "pest" | "nutrient_deficiency" | "other" | "water_stress" | "weed";
        severity: "low" | "medium" | "high";
        issueName: string;
        status?: "open" | "monitoring" | "resolved" | undefined;
        observation?: string | undefined;
        recommendations?: {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
            reviewDate?: string | undefined;
        }[] | undefined;
        issueMasterId?: string | undefined;
        photos?: {
            mimeType: string;
            filename: string;
            dataBase64: string;
        }[] | undefined;
    }, {
        category: "disease" | "pest" | "nutrient_deficiency" | "other" | "water_stress" | "weed";
        severity: "low" | "medium" | "high";
        issueName: string;
        status?: "open" | "monitoring" | "resolved" | undefined;
        observation?: string | undefined;
        recommendations?: {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
            reviewDate?: string | undefined;
        }[] | undefined;
        issueMasterId?: string | undefined;
        photos?: {
            mimeType: string;
            filename: string;
            dataBase64: string;
        }[] | undefined;
    }>, "many">;
    followUps: z.ZodOptional<z.ZodArray<z.ZodObject<{
        recommendationId: z.ZodString;
        followed: z.ZodEnum<["yes", "partially", "no", "not_applicable"]>;
        outcome: z.ZodEnum<["improved", "no_change", "worsened", "not_reviewed"]>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        outcome: "improved" | "worsened" | "no_change" | "not_reviewed";
        recommendationId: string;
        followed: "yes" | "partially" | "no" | "not_applicable";
        notes?: string | undefined;
    }, {
        outcome: "improved" | "worsened" | "no_change" | "not_reviewed";
        recommendationId: string;
        followed: "yes" | "partially" | "no" | "not_applicable";
        notes?: string | undefined;
    }>, "many">>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    issues: {
        category: "disease" | "pest" | "nutrient_deficiency" | "other" | "water_stress" | "weed";
        severity: "low" | "medium" | "high";
        issueName: string;
        status?: "open" | "monitoring" | "resolved" | undefined;
        observation?: string | undefined;
        recommendations?: {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
            reviewDate?: string | undefined;
        }[] | undefined;
        issueMasterId?: string | undefined;
        photos?: {
            mimeType: string;
            filename: string;
            dataBase64: string;
        }[] | undefined;
    }[];
    farmerId: string;
    blockId: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
    leadId?: string | undefined;
    followUps?: {
        outcome: "improved" | "worsened" | "no_change" | "not_reviewed";
        recommendationId: string;
        followed: "yes" | "partially" | "no" | "not_applicable";
        notes?: string | undefined;
    }[] | undefined;
    visitedAt?: string | undefined;
    blockAssessment?: {
        blockHealth: "good" | "average" | "need_assistance";
        cropPerformance: "above_expectation" | "as_expected" | "below_expectation";
        soilMoisture: "dry" | "optimal" | "wet" | "waterlogged";
    } | undefined;
    measurements?: {
        value: string;
        key: string;
        unit?: string | undefined;
    }[] | undefined;
}, {
    issues: {
        category: "disease" | "pest" | "nutrient_deficiency" | "other" | "water_stress" | "weed";
        severity: "low" | "medium" | "high";
        issueName: string;
        status?: "open" | "monitoring" | "resolved" | undefined;
        observation?: string | undefined;
        recommendations?: {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
            reviewDate?: string | undefined;
        }[] | undefined;
        issueMasterId?: string | undefined;
        photos?: {
            mimeType: string;
            filename: string;
            dataBase64: string;
        }[] | undefined;
    }[];
    farmerId: string;
    blockId: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
    leadId?: string | undefined;
    followUps?: {
        outcome: "improved" | "worsened" | "no_change" | "not_reviewed";
        recommendationId: string;
        followed: "yes" | "partially" | "no" | "not_applicable";
        notes?: string | undefined;
    }[] | undefined;
    visitedAt?: string | undefined;
    blockAssessment?: {
        blockHealth: "good" | "average" | "need_assistance";
        cropPerformance: "above_expectation" | "as_expected" | "below_expectation";
        soilMoisture: "dry" | "optimal" | "wet" | "waterlogged";
    } | undefined;
    measurements?: {
        value: string;
        key: string;
        unit?: string | undefined;
    }[] | undefined;
}>;
export type StructuredFieldVisitInput = z.infer<typeof structuredFieldVisitSchema>;
//# sourceMappingURL=validators.d.ts.map