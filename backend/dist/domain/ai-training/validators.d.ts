import { z } from 'zod';
export declare const findingTypeSchema: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "irrigation", "weather_stress", "growth_observation", "other"]>;
export declare const reviewSeveritySchema: z.ZodEnum<["mild", "moderate", "severe"]>;
export declare const reviewActionSchema: z.ZodEnum<["approve_ai", "correct_ai", "partial_match", "escalate_urgent", "reject_recommendation"]>;
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
    severity?: "moderate" | "mild" | "severe" | undefined;
    agronomistLabel?: string | undefined;
    reviewNotes?: string | undefined;
}, {
    action: "correct_ai" | "confirm_ai" | "skip" | "exclude";
    severity?: "moderate" | "mild" | "severe" | undefined;
    agronomistLabel?: string | undefined;
    reviewNotes?: string | undefined;
}>, {
    action: "correct_ai" | "confirm_ai" | "skip" | "exclude";
    severity?: "moderate" | "mild" | "severe" | undefined;
    agronomistLabel?: string | undefined;
    reviewNotes?: string | undefined;
}, {
    action: "correct_ai" | "confirm_ai" | "skip" | "exclude";
    severity?: "moderate" | "mild" | "severe" | undefined;
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
    severity?: "moderate" | "mild" | "severe" | undefined;
    weatherContext?: Record<string, unknown> | undefined;
    aiPrediction?: string | undefined;
    findingType?: "disease" | "pest" | "nutrient_deficiency" | "irrigation" | "weather_stress" | "growth_observation" | "other" | undefined;
    affectedAreaPct?: number | undefined;
    finalConfirmedIssue?: string | undefined;
}, {
    severity?: "moderate" | "mild" | "severe" | undefined;
    weatherContext?: Record<string, unknown> | undefined;
    aiPrediction?: string | undefined;
    findingType?: "disease" | "pest" | "nutrient_deficiency" | "irrigation" | "weather_stress" | "growth_observation" | "other" | undefined;
    affectedAreaPct?: number | undefined;
    finalConfirmedIssue?: string | undefined;
}>;
/** Max WhatsApp recommendation body (agronomist case review). DB is TEXT; outbound WhatsApp capped separately. */
export declare const CASE_REVIEW_RECOMMENDATION_TEXT_MAX = 8000;
/** Case review submission */
export declare const caseReviewBodySchema: z.ZodObject<{
    action: z.ZodEnum<["approve_ai", "correct_ai", "partial_match", "escalate_urgent", "reject_recommendation"]>;
    correctDiagnosis: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<["mild", "moderate", "severe"]>>;
    recommendationText: z.ZodOptional<z.ZodString>;
    dosage: z.ZodOptional<z.ZodString>;
    notesForLearning: z.ZodOptional<z.ZodString>;
    submitForApproval: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
    severity?: "moderate" | "mild" | "severe" | undefined;
    correctDiagnosis?: string | undefined;
    dosage?: string | undefined;
    recommendationText?: string | undefined;
    notesForLearning?: string | undefined;
    submitForApproval?: boolean | undefined;
}, {
    action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
    severity?: "moderate" | "mild" | "severe" | undefined;
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
export declare const issueCategorySchema: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "nutrient_toxicity", "water_stress", "environmental_stress", "soil_problem", "growth_issue", "chemical_injury", "mechanical_damage", "weed", "other"]>;
export declare const recommendationTypeSchema: z.ZodEnum<["disease_management", "pest_management", "nutrient_management", "irrigation", "soil_amendment", "monitoring", "other"]>;
export declare const recommendationPrioritySchema: z.ZodEnum<["normal", "high", "critical"]>;
export declare const fieldRecStatusSchema: z.ZodEnum<["open", "monitoring", "completed", "escalated"]>;
export declare const recommendationFollowedSchema: z.ZodEnum<["yes", "partially", "no", "not_applicable"]>;
export declare const visitFollowupOutcomeSchema: z.ZodEnum<["improved", "no_change", "worsened", "not_reviewed"]>;
export declare const recordSeveritySchema: z.ZodEnum<["low", "medium", "high"]>;
export declare const agronomistReviewSchema: z.ZodObject<{
    action: z.ZodEnum<["approve_ai", "correct_ai", "partial_match", "escalate_urgent", "reject_recommendation"]>;
    finalDiagnosis: z.ZodOptional<z.ZodString>;
    finalRecommendation: z.ZodOptional<z.ZodString>;
    modificationReason: z.ZodOptional<z.ZodString>;
    agronomistConfidence: z.ZodOptional<z.ZodNumber>;
    yieldRisk: z.ZodOptional<z.ZodString>;
    rejectReason: z.ZodOptional<z.ZodEnum<["wrong_diagnosis", "need_more_evidence", "recommendation_not_suitable", "custom_recommendation"]>>;
    rejectNote: z.ZodOptional<z.ZodString>;
    correctedDiagnosis: z.ZodOptional<z.ZodString>;
    evidenceRequest: z.ZodOptional<z.ZodObject<{
        photoTypes: z.ZodArray<z.ZodString, "many">;
        questions: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            text: z.ZodString;
            answer: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            key: string;
            answer?: string | undefined;
        }, {
            text: string;
            key: string;
            answer?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        questions: {
            text: string;
            key: string;
            answer?: string | undefined;
        }[];
        photoTypes: string[];
    }, {
        questions: {
            text: string;
            key: string;
            answer?: string | undefined;
        }[];
        photoTypes: string[];
    }>>;
    customRecommendation: z.ZodOptional<z.ZodObject<{
        product: z.ZodString;
        dose: z.ZodString;
        method: z.ZodString;
        reviewDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    }, {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    }>>;
    rejectFlowComplete: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
    finalDiagnosis?: string | undefined;
    finalRecommendation?: string | undefined;
    modificationReason?: string | undefined;
    agronomistConfidence?: number | undefined;
    yieldRisk?: string | undefined;
    rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
    rejectNote?: string | undefined;
    correctedDiagnosis?: string | undefined;
    evidenceRequest?: {
        questions: {
            text: string;
            key: string;
            answer?: string | undefined;
        }[];
        photoTypes: string[];
    } | undefined;
    customRecommendation?: {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    } | undefined;
    rejectFlowComplete?: boolean | undefined;
}, {
    action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
    finalDiagnosis?: string | undefined;
    finalRecommendation?: string | undefined;
    modificationReason?: string | undefined;
    agronomistConfidence?: number | undefined;
    yieldRisk?: string | undefined;
    rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
    rejectNote?: string | undefined;
    correctedDiagnosis?: string | undefined;
    evidenceRequest?: {
        questions: {
            text: string;
            key: string;
            answer?: string | undefined;
        }[];
        photoTypes: string[];
    } | undefined;
    customRecommendation?: {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    } | undefined;
    rejectFlowComplete?: boolean | undefined;
}>;
export declare const recommendationGroupSchema: z.ZodObject<{
    applicationType: z.ZodString;
    applicationDay: z.ZodOptional<z.ZodNumber>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    materials: z.ZodArray<z.ZodObject<{
        issueIndex: z.ZodOptional<z.ZodNumber>;
        issueId: z.ZodOptional<z.ZodString>;
        category: z.ZodString;
        technicalName: z.ZodString;
        dose: z.ZodOptional<z.ZodString>;
        method: z.ZodOptional<z.ZodString>;
        relatedIssueIndex: z.ZodOptional<z.ZodNumber>;
        relatedIssueId: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        category: string;
        technicalName: string;
        method?: string | undefined;
        sortOrder?: number | undefined;
        dose?: string | undefined;
        issueIndex?: number | undefined;
        issueId?: string | undefined;
        relatedIssueIndex?: number | undefined;
        relatedIssueId?: string | undefined;
    }, {
        category: string;
        technicalName: string;
        method?: string | undefined;
        sortOrder?: number | undefined;
        dose?: string | undefined;
        issueIndex?: number | undefined;
        issueId?: string | undefined;
        relatedIssueIndex?: number | undefined;
        relatedIssueId?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    applicationType: string;
    materials: {
        category: string;
        technicalName: string;
        method?: string | undefined;
        sortOrder?: number | undefined;
        dose?: string | undefined;
        issueIndex?: number | undefined;
        issueId?: string | undefined;
        relatedIssueIndex?: number | undefined;
        relatedIssueId?: string | undefined;
    }[];
    sortOrder?: number | undefined;
    applicationDay?: number | undefined;
}, {
    applicationType: string;
    materials: {
        category: string;
        technicalName: string;
        method?: string | undefined;
        sortOrder?: number | undefined;
        dose?: string | undefined;
        issueIndex?: number | undefined;
        issueId?: string | undefined;
        relatedIssueIndex?: number | undefined;
        relatedIssueId?: string | undefined;
    }[];
    sortOrder?: number | undefined;
    applicationDay?: number | undefined;
}>;
export declare const visitIssueInputSchema: z.ZodObject<{
    category: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "nutrient_toxicity", "water_stress", "environmental_stress", "soil_problem", "growth_issue", "chemical_injury", "mechanical_damage", "weed", "other"]>;
    issueMasterId: z.ZodOptional<z.ZodString>;
    issueName: z.ZodString;
    severity: z.ZodEnum<["low", "medium", "high"]>;
    observation: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["open", "monitoring", "resolved"]>>;
    photos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        mimeType: z.ZodString;
        dataBase64: z.ZodString;
        photoType: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        mimeType: string;
        filename: string;
        dataBase64: string;
        photoType?: string | undefined;
    }, {
        mimeType: string;
        filename: string;
        dataBase64: string;
        photoType?: string | undefined;
    }>, "many">>;
    aiCaseId: z.ZodOptional<z.ZodString>;
    agronomistReview: z.ZodOptional<z.ZodObject<{
        action: z.ZodEnum<["approve_ai", "correct_ai", "partial_match", "escalate_urgent", "reject_recommendation"]>;
        finalDiagnosis: z.ZodOptional<z.ZodString>;
        finalRecommendation: z.ZodOptional<z.ZodString>;
        modificationReason: z.ZodOptional<z.ZodString>;
        agronomistConfidence: z.ZodOptional<z.ZodNumber>;
        yieldRisk: z.ZodOptional<z.ZodString>;
        rejectReason: z.ZodOptional<z.ZodEnum<["wrong_diagnosis", "need_more_evidence", "recommendation_not_suitable", "custom_recommendation"]>>;
        rejectNote: z.ZodOptional<z.ZodString>;
        correctedDiagnosis: z.ZodOptional<z.ZodString>;
        evidenceRequest: z.ZodOptional<z.ZodObject<{
            photoTypes: z.ZodArray<z.ZodString, "many">;
            questions: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                text: z.ZodString;
                answer: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                text: string;
                key: string;
                answer?: string | undefined;
            }, {
                text: string;
                key: string;
                answer?: string | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            questions: {
                text: string;
                key: string;
                answer?: string | undefined;
            }[];
            photoTypes: string[];
        }, {
            questions: {
                text: string;
                key: string;
                answer?: string | undefined;
            }[];
            photoTypes: string[];
        }>>;
        customRecommendation: z.ZodOptional<z.ZodObject<{
            product: z.ZodString;
            dose: z.ZodString;
            method: z.ZodString;
            reviewDate: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            method: string;
            product: string;
            dose: string;
            reviewDate?: string | undefined;
        }, {
            method: string;
            product: string;
            dose: string;
            reviewDate?: string | undefined;
        }>>;
        rejectFlowComplete: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        modificationReason?: string | undefined;
        agronomistConfidence?: number | undefined;
        yieldRisk?: string | undefined;
        rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
        rejectNote?: string | undefined;
        correctedDiagnosis?: string | undefined;
        evidenceRequest?: {
            questions: {
                text: string;
                key: string;
                answer?: string | undefined;
            }[];
            photoTypes: string[];
        } | undefined;
        customRecommendation?: {
            method: string;
            product: string;
            dose: string;
            reviewDate?: string | undefined;
        } | undefined;
        rejectFlowComplete?: boolean | undefined;
    }, {
        action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        modificationReason?: string | undefined;
        agronomistConfidence?: number | undefined;
        yieldRisk?: string | undefined;
        rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
        rejectNote?: string | undefined;
        correctedDiagnosis?: string | undefined;
        evidenceRequest?: {
            questions: {
                text: string;
                key: string;
                answer?: string | undefined;
            }[];
            photoTypes: string[];
        } | undefined;
        customRecommendation?: {
            method: string;
            product: string;
            dose: string;
            reviewDate?: string | undefined;
        } | undefined;
        rejectFlowComplete?: boolean | undefined;
    }>>;
    finalDiagnosis: z.ZodOptional<z.ZodString>;
    finalRecommendation: z.ZodOptional<z.ZodString>;
    reviewAfterDays: z.ZodOptional<z.ZodNumber>;
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
        reviewDate?: string | undefined;
        recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
        reviewAfterDays?: number | undefined;
    }, {
        text: string;
        status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
        priority?: "high" | "normal" | "critical" | undefined;
        reviewDate?: string | undefined;
        recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
        reviewAfterDays?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    category: "disease" | "pest" | "nutrient_deficiency" | "other" | "nutrient_toxicity" | "water_stress" | "environmental_stress" | "soil_problem" | "growth_issue" | "chemical_injury" | "mechanical_damage" | "weed";
    severity: "low" | "high" | "medium";
    issueName: string;
    status?: "open" | "monitoring" | "resolved" | undefined;
    observation?: string | undefined;
    recommendations?: {
        text: string;
        status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
        priority?: "high" | "normal" | "critical" | undefined;
        reviewDate?: string | undefined;
        recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
        reviewAfterDays?: number | undefined;
    }[] | undefined;
    finalDiagnosis?: string | undefined;
    finalRecommendation?: string | undefined;
    reviewAfterDays?: number | undefined;
    issueMasterId?: string | undefined;
    photos?: {
        mimeType: string;
        filename: string;
        dataBase64: string;
        photoType?: string | undefined;
    }[] | undefined;
    aiCaseId?: string | undefined;
    agronomistReview?: {
        action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        modificationReason?: string | undefined;
        agronomistConfidence?: number | undefined;
        yieldRisk?: string | undefined;
        rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
        rejectNote?: string | undefined;
        correctedDiagnosis?: string | undefined;
        evidenceRequest?: {
            questions: {
                text: string;
                key: string;
                answer?: string | undefined;
            }[];
            photoTypes: string[];
        } | undefined;
        customRecommendation?: {
            method: string;
            product: string;
            dose: string;
            reviewDate?: string | undefined;
        } | undefined;
        rejectFlowComplete?: boolean | undefined;
    } | undefined;
}, {
    category: "disease" | "pest" | "nutrient_deficiency" | "other" | "nutrient_toxicity" | "water_stress" | "environmental_stress" | "soil_problem" | "growth_issue" | "chemical_injury" | "mechanical_damage" | "weed";
    severity: "low" | "high" | "medium";
    issueName: string;
    status?: "open" | "monitoring" | "resolved" | undefined;
    observation?: string | undefined;
    recommendations?: {
        text: string;
        status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
        priority?: "high" | "normal" | "critical" | undefined;
        reviewDate?: string | undefined;
        recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
        reviewAfterDays?: number | undefined;
    }[] | undefined;
    finalDiagnosis?: string | undefined;
    finalRecommendation?: string | undefined;
    reviewAfterDays?: number | undefined;
    issueMasterId?: string | undefined;
    photos?: {
        mimeType: string;
        filename: string;
        dataBase64: string;
        photoType?: string | undefined;
    }[] | undefined;
    aiCaseId?: string | undefined;
    agronomistReview?: {
        action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        modificationReason?: string | undefined;
        agronomistConfidence?: number | undefined;
        yieldRisk?: string | undefined;
        rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
        rejectNote?: string | undefined;
        correctedDiagnosis?: string | undefined;
        evidenceRequest?: {
            questions: {
                text: string;
                key: string;
                answer?: string | undefined;
            }[];
            photoTypes: string[];
        } | undefined;
        customRecommendation?: {
            method: string;
            product: string;
            dose: string;
            reviewDate?: string | undefined;
        } | undefined;
        rejectFlowComplete?: boolean | undefined;
    } | undefined;
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
    visitClassification: z.ZodOptional<z.ZodEnum<["first", "follow_up", "rectification"]>>;
    selectedRecommendationOptionId: z.ZodOptional<z.ZodString>;
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
    visitPhotos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        mimeType: z.ZodString;
        dataBase64: z.ZodString;
        photoType: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        mimeType: string;
        filename: string;
        dataBase64: string;
        photoType?: string | undefined;
    }, {
        mimeType: string;
        filename: string;
        dataBase64: string;
        photoType?: string | undefined;
    }>, "many">>;
    issues: z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "nutrient_toxicity", "water_stress", "environmental_stress", "soil_problem", "growth_issue", "chemical_injury", "mechanical_damage", "weed", "other"]>;
        issueMasterId: z.ZodOptional<z.ZodString>;
        issueName: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high"]>;
        observation: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["open", "monitoring", "resolved"]>>;
        photos: z.ZodOptional<z.ZodArray<z.ZodObject<{
            filename: z.ZodString;
            mimeType: z.ZodString;
            dataBase64: z.ZodString;
            photoType: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            mimeType: string;
            filename: string;
            dataBase64: string;
            photoType?: string | undefined;
        }, {
            mimeType: string;
            filename: string;
            dataBase64: string;
            photoType?: string | undefined;
        }>, "many">>;
        aiCaseId: z.ZodOptional<z.ZodString>;
        agronomistReview: z.ZodOptional<z.ZodObject<{
            action: z.ZodEnum<["approve_ai", "correct_ai", "partial_match", "escalate_urgent", "reject_recommendation"]>;
            finalDiagnosis: z.ZodOptional<z.ZodString>;
            finalRecommendation: z.ZodOptional<z.ZodString>;
            modificationReason: z.ZodOptional<z.ZodString>;
            agronomistConfidence: z.ZodOptional<z.ZodNumber>;
            yieldRisk: z.ZodOptional<z.ZodString>;
            rejectReason: z.ZodOptional<z.ZodEnum<["wrong_diagnosis", "need_more_evidence", "recommendation_not_suitable", "custom_recommendation"]>>;
            rejectNote: z.ZodOptional<z.ZodString>;
            correctedDiagnosis: z.ZodOptional<z.ZodString>;
            evidenceRequest: z.ZodOptional<z.ZodObject<{
                photoTypes: z.ZodArray<z.ZodString, "many">;
                questions: z.ZodArray<z.ZodObject<{
                    key: z.ZodString;
                    text: z.ZodString;
                    answer: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }, {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                questions: {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }[];
                photoTypes: string[];
            }, {
                questions: {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }[];
                photoTypes: string[];
            }>>;
            customRecommendation: z.ZodOptional<z.ZodObject<{
                product: z.ZodString;
                dose: z.ZodString;
                method: z.ZodString;
                reviewDate: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                method: string;
                product: string;
                dose: string;
                reviewDate?: string | undefined;
            }, {
                method: string;
                product: string;
                dose: string;
                reviewDate?: string | undefined;
            }>>;
            rejectFlowComplete: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
            finalDiagnosis?: string | undefined;
            finalRecommendation?: string | undefined;
            modificationReason?: string | undefined;
            agronomistConfidence?: number | undefined;
            yieldRisk?: string | undefined;
            rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
            rejectNote?: string | undefined;
            correctedDiagnosis?: string | undefined;
            evidenceRequest?: {
                questions: {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }[];
                photoTypes: string[];
            } | undefined;
            customRecommendation?: {
                method: string;
                product: string;
                dose: string;
                reviewDate?: string | undefined;
            } | undefined;
            rejectFlowComplete?: boolean | undefined;
        }, {
            action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
            finalDiagnosis?: string | undefined;
            finalRecommendation?: string | undefined;
            modificationReason?: string | undefined;
            agronomistConfidence?: number | undefined;
            yieldRisk?: string | undefined;
            rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
            rejectNote?: string | undefined;
            correctedDiagnosis?: string | undefined;
            evidenceRequest?: {
                questions: {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }[];
                photoTypes: string[];
            } | undefined;
            customRecommendation?: {
                method: string;
                product: string;
                dose: string;
                reviewDate?: string | undefined;
            } | undefined;
            rejectFlowComplete?: boolean | undefined;
        }>>;
        finalDiagnosis: z.ZodOptional<z.ZodString>;
        finalRecommendation: z.ZodOptional<z.ZodString>;
        reviewAfterDays: z.ZodOptional<z.ZodNumber>;
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
            reviewDate?: string | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
        }, {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            reviewDate?: string | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        category: "disease" | "pest" | "nutrient_deficiency" | "other" | "nutrient_toxicity" | "water_stress" | "environmental_stress" | "soil_problem" | "growth_issue" | "chemical_injury" | "mechanical_damage" | "weed";
        severity: "low" | "high" | "medium";
        issueName: string;
        status?: "open" | "monitoring" | "resolved" | undefined;
        observation?: string | undefined;
        recommendations?: {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            reviewDate?: string | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
        }[] | undefined;
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        reviewAfterDays?: number | undefined;
        issueMasterId?: string | undefined;
        photos?: {
            mimeType: string;
            filename: string;
            dataBase64: string;
            photoType?: string | undefined;
        }[] | undefined;
        aiCaseId?: string | undefined;
        agronomistReview?: {
            action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
            finalDiagnosis?: string | undefined;
            finalRecommendation?: string | undefined;
            modificationReason?: string | undefined;
            agronomistConfidence?: number | undefined;
            yieldRisk?: string | undefined;
            rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
            rejectNote?: string | undefined;
            correctedDiagnosis?: string | undefined;
            evidenceRequest?: {
                questions: {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }[];
                photoTypes: string[];
            } | undefined;
            customRecommendation?: {
                method: string;
                product: string;
                dose: string;
                reviewDate?: string | undefined;
            } | undefined;
            rejectFlowComplete?: boolean | undefined;
        } | undefined;
    }, {
        category: "disease" | "pest" | "nutrient_deficiency" | "other" | "nutrient_toxicity" | "water_stress" | "environmental_stress" | "soil_problem" | "growth_issue" | "chemical_injury" | "mechanical_damage" | "weed";
        severity: "low" | "high" | "medium";
        issueName: string;
        status?: "open" | "monitoring" | "resolved" | undefined;
        observation?: string | undefined;
        recommendations?: {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            reviewDate?: string | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
        }[] | undefined;
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        reviewAfterDays?: number | undefined;
        issueMasterId?: string | undefined;
        photos?: {
            mimeType: string;
            filename: string;
            dataBase64: string;
            photoType?: string | undefined;
        }[] | undefined;
        aiCaseId?: string | undefined;
        agronomistReview?: {
            action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
            finalDiagnosis?: string | undefined;
            finalRecommendation?: string | undefined;
            modificationReason?: string | undefined;
            agronomistConfidence?: number | undefined;
            yieldRisk?: string | undefined;
            rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
            rejectNote?: string | undefined;
            correctedDiagnosis?: string | undefined;
            evidenceRequest?: {
                questions: {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }[];
                photoTypes: string[];
            } | undefined;
            customRecommendation?: {
                method: string;
                product: string;
                dose: string;
                reviewDate?: string | undefined;
            } | undefined;
            rejectFlowComplete?: boolean | undefined;
        } | undefined;
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
    recommendationGroups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        applicationType: z.ZodString;
        applicationDay: z.ZodOptional<z.ZodNumber>;
        sortOrder: z.ZodOptional<z.ZodNumber>;
        materials: z.ZodArray<z.ZodObject<{
            issueIndex: z.ZodOptional<z.ZodNumber>;
            issueId: z.ZodOptional<z.ZodString>;
            category: z.ZodString;
            technicalName: z.ZodString;
            dose: z.ZodOptional<z.ZodString>;
            method: z.ZodOptional<z.ZodString>;
            relatedIssueIndex: z.ZodOptional<z.ZodNumber>;
            relatedIssueId: z.ZodOptional<z.ZodString>;
            sortOrder: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }, {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }, {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }>, "many">>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    sendVisitSummary: z.ZodOptional<z.ZodBoolean>;
    whatsappMessages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        issueIndex: z.ZodNumber;
        message: z.ZodString;
        compliancePrompt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        issueIndex: number;
        compliancePrompt?: string | undefined;
    }, {
        message: string;
        issueIndex: number;
        compliancePrompt?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    issues: {
        category: "disease" | "pest" | "nutrient_deficiency" | "other" | "nutrient_toxicity" | "water_stress" | "environmental_stress" | "soil_problem" | "growth_issue" | "chemical_injury" | "mechanical_damage" | "weed";
        severity: "low" | "high" | "medium";
        issueName: string;
        status?: "open" | "monitoring" | "resolved" | undefined;
        observation?: string | undefined;
        recommendations?: {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            reviewDate?: string | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
        }[] | undefined;
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        reviewAfterDays?: number | undefined;
        issueMasterId?: string | undefined;
        photos?: {
            mimeType: string;
            filename: string;
            dataBase64: string;
            photoType?: string | undefined;
        }[] | undefined;
        aiCaseId?: string | undefined;
        agronomistReview?: {
            action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
            finalDiagnosis?: string | undefined;
            finalRecommendation?: string | undefined;
            modificationReason?: string | undefined;
            agronomistConfidence?: number | undefined;
            yieldRisk?: string | undefined;
            rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
            rejectNote?: string | undefined;
            correctedDiagnosis?: string | undefined;
            evidenceRequest?: {
                questions: {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }[];
                photoTypes: string[];
            } | undefined;
            customRecommendation?: {
                method: string;
                product: string;
                dose: string;
                reviewDate?: string | undefined;
            } | undefined;
            rejectFlowComplete?: boolean | undefined;
        } | undefined;
    }[];
    farmerId: string;
    blockId: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
    leadId?: string | undefined;
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
    followUps?: {
        outcome: "improved" | "worsened" | "no_change" | "not_reviewed";
        recommendationId: string;
        followed: "yes" | "partially" | "no" | "not_applicable";
        notes?: string | undefined;
    }[] | undefined;
    visitedAt?: string | undefined;
    visitClassification?: "follow_up" | "first" | "rectification" | undefined;
    selectedRecommendationOptionId?: string | undefined;
    visitPhotos?: {
        mimeType: string;
        filename: string;
        dataBase64: string;
        photoType?: string | undefined;
    }[] | undefined;
    recommendationGroups?: {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }[] | undefined;
    sendVisitSummary?: boolean | undefined;
    whatsappMessages?: {
        message: string;
        issueIndex: number;
        compliancePrompt?: string | undefined;
    }[] | undefined;
}, {
    issues: {
        category: "disease" | "pest" | "nutrient_deficiency" | "other" | "nutrient_toxicity" | "water_stress" | "environmental_stress" | "soil_problem" | "growth_issue" | "chemical_injury" | "mechanical_damage" | "weed";
        severity: "low" | "high" | "medium";
        issueName: string;
        status?: "open" | "monitoring" | "resolved" | undefined;
        observation?: string | undefined;
        recommendations?: {
            text: string;
            status?: "escalated" | "open" | "monitoring" | "completed" | undefined;
            priority?: "high" | "normal" | "critical" | undefined;
            reviewDate?: string | undefined;
            recommendationType?: "irrigation" | "other" | "monitoring" | "disease_management" | "pest_management" | "nutrient_management" | "soil_amendment" | undefined;
            reviewAfterDays?: number | undefined;
        }[] | undefined;
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        reviewAfterDays?: number | undefined;
        issueMasterId?: string | undefined;
        photos?: {
            mimeType: string;
            filename: string;
            dataBase64: string;
            photoType?: string | undefined;
        }[] | undefined;
        aiCaseId?: string | undefined;
        agronomistReview?: {
            action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | "reject_recommendation";
            finalDiagnosis?: string | undefined;
            finalRecommendation?: string | undefined;
            modificationReason?: string | undefined;
            agronomistConfidence?: number | undefined;
            yieldRisk?: string | undefined;
            rejectReason?: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation" | undefined;
            rejectNote?: string | undefined;
            correctedDiagnosis?: string | undefined;
            evidenceRequest?: {
                questions: {
                    text: string;
                    key: string;
                    answer?: string | undefined;
                }[];
                photoTypes: string[];
            } | undefined;
            customRecommendation?: {
                method: string;
                product: string;
                dose: string;
                reviewDate?: string | undefined;
            } | undefined;
            rejectFlowComplete?: boolean | undefined;
        } | undefined;
    }[];
    farmerId: string;
    blockId: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
    leadId?: string | undefined;
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
    followUps?: {
        outcome: "improved" | "worsened" | "no_change" | "not_reviewed";
        recommendationId: string;
        followed: "yes" | "partially" | "no" | "not_applicable";
        notes?: string | undefined;
    }[] | undefined;
    visitedAt?: string | undefined;
    visitClassification?: "follow_up" | "first" | "rectification" | undefined;
    selectedRecommendationOptionId?: string | undefined;
    visitPhotos?: {
        mimeType: string;
        filename: string;
        dataBase64: string;
        photoType?: string | undefined;
    }[] | undefined;
    recommendationGroups?: {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }[] | undefined;
    sendVisitSummary?: boolean | undefined;
    whatsappMessages?: {
        message: string;
        issueIndex: number;
        compliancePrompt?: string | undefined;
    }[] | undefined;
}>;
export declare const visitAiContextRequestSchema: z.ZodObject<{
    farmerId: z.ZodString;
    blockId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
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
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    fieldVoiceNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    farmerId: string;
    blockId: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
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
    fieldVoiceNote?: string | undefined;
}, {
    farmerId: string;
    blockId: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
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
    fieldVoiceNote?: string | undefined;
}>;
export declare const visitAnalyzeRequestSchema: z.ZodObject<{
    farmerId: z.ZodString;
    blockId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
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
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    fieldVoiceNote: z.ZodOptional<z.ZodString>;
} & {
    issueCategory: z.ZodEnum<["disease", "pest", "nutrient_deficiency", "nutrient_toxicity", "water_stress", "environmental_stress", "soil_problem", "growth_issue", "chemical_injury", "mechanical_damage", "weed", "other"]>;
    issueName: z.ZodString;
    observation: z.ZodOptional<z.ZodString>;
    photoRefs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    analyzePhotos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        dataBase64: z.ZodString;
        mimeType: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        dataBase64: string;
        mimeType?: string | undefined;
    }, {
        dataBase64: string;
        mimeType?: string | undefined;
    }>, "many">>;
    selectedHypothesisLabel: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    farmerId: string;
    blockId: string;
    issueCategory: "disease" | "pest" | "nutrient_deficiency" | "other" | "nutrient_toxicity" | "water_stress" | "environmental_stress" | "soil_problem" | "growth_issue" | "chemical_injury" | "mechanical_damage" | "weed";
    issueName: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
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
    observation?: string | undefined;
    fieldVoiceNote?: string | undefined;
    photoRefs?: string[] | undefined;
    analyzePhotos?: {
        dataBase64: string;
        mimeType?: string | undefined;
    }[] | undefined;
    selectedHypothesisLabel?: string | undefined;
}, {
    farmerId: string;
    blockId: string;
    issueCategory: "disease" | "pest" | "nutrient_deficiency" | "other" | "nutrient_toxicity" | "water_stress" | "environmental_stress" | "soil_problem" | "growth_issue" | "chemical_injury" | "mechanical_damage" | "weed";
    issueName: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
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
    observation?: string | undefined;
    fieldVoiceNote?: string | undefined;
    photoRefs?: string[] | undefined;
    analyzePhotos?: {
        dataBase64: string;
        mimeType?: string | undefined;
    }[] | undefined;
    selectedHypothesisLabel?: string | undefined;
}>;
export declare const visitAiAnswerSchema: z.ZodObject<{
    questionId: z.ZodString;
    answer: z.ZodString;
}, "strip", z.ZodTypeAny, {
    questionId: string;
    answer: string;
}, {
    questionId: string;
    answer: string;
}>;
export declare const visitAiAnswersBodySchema: z.ZodObject<{
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        answer: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        answer: string;
    }, {
        questionId: string;
        answer: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    answers: {
        questionId: string;
        answer: string;
    }[];
}, {
    answers: {
        questionId: string;
        answer: string;
    }[];
}>;
export declare const visitAiQuestionDraftSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    questionText: z.ZodString;
    answer: z.ZodOptional<z.ZodString>;
    answerType: z.ZodOptional<z.ZodEnum<["yes_no_unknown", "text", "number"]>>;
}, "strip", z.ZodTypeAny, {
    questionText: string;
    id?: string | undefined;
    answer?: string | undefined;
    answerType?: "number" | "text" | "yes_no_unknown" | undefined;
}, {
    questionText: string;
    id?: string | undefined;
    answer?: string | undefined;
    answerType?: "number" | "text" | "yes_no_unknown" | undefined;
}>;
export declare const visitAiSyncQuestionsBodySchema: z.ZodObject<{
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        questionText: z.ZodString;
        answer: z.ZodOptional<z.ZodString>;
        answerType: z.ZodOptional<z.ZodEnum<["yes_no_unknown", "text", "number"]>>;
    }, "strip", z.ZodTypeAny, {
        questionText: string;
        id?: string | undefined;
        answer?: string | undefined;
        answerType?: "number" | "text" | "yes_no_unknown" | undefined;
    }, {
        questionText: string;
        id?: string | undefined;
        answer?: string | undefined;
        answerType?: "number" | "text" | "yes_no_unknown" | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    questions: {
        questionText: string;
        id?: string | undefined;
        answer?: string | undefined;
        answerType?: "number" | "text" | "yes_no_unknown" | undefined;
    }[];
}, {
    questions: {
        questionText: string;
        id?: string | undefined;
        answer?: string | undefined;
        answerType?: "number" | "text" | "yes_no_unknown" | undefined;
    }[];
}>;
export type VisitAiSyncQuestionsBody = z.infer<typeof visitAiSyncQuestionsBodySchema>;
export declare const visitAiRecommendBodySchema: z.ZodObject<{
    finalDiagnosis: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    finalDiagnosis?: string | undefined;
}, {
    finalDiagnosis?: string | undefined;
}>;
export declare const visitAiRejectBodySchema: z.ZodEffects<z.ZodObject<{
    reason: z.ZodEnum<["wrong_diagnosis", "need_more_evidence", "recommendation_not_suitable", "custom_recommendation"]>;
    correctedDiagnosis: z.ZodOptional<z.ZodString>;
    rejectNote: z.ZodOptional<z.ZodString>;
    editedRecommendation: z.ZodOptional<z.ZodString>;
    evidenceRequest: z.ZodOptional<z.ZodObject<{
        photoTypes: z.ZodArray<z.ZodString, "many">;
        questions: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            text: z.ZodString;
            answer: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            text: string;
            key: string;
            answer: string;
        }, {
            text: string;
            key: string;
            answer: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        questions: {
            text: string;
            key: string;
            answer: string;
        }[];
        photoTypes: string[];
    }, {
        questions: {
            text: string;
            key: string;
            answer: string;
        }[];
        photoTypes: string[];
    }>>;
    customRecommendation: z.ZodOptional<z.ZodObject<{
        product: z.ZodString;
        dose: z.ZodString;
        method: z.ZodString;
        reviewDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    }, {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    reason: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation";
    rejectNote?: string | undefined;
    correctedDiagnosis?: string | undefined;
    evidenceRequest?: {
        questions: {
            text: string;
            key: string;
            answer: string;
        }[];
        photoTypes: string[];
    } | undefined;
    customRecommendation?: {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    } | undefined;
    editedRecommendation?: string | undefined;
}, {
    reason: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation";
    rejectNote?: string | undefined;
    correctedDiagnosis?: string | undefined;
    evidenceRequest?: {
        questions: {
            text: string;
            key: string;
            answer: string;
        }[];
        photoTypes: string[];
    } | undefined;
    customRecommendation?: {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    } | undefined;
    editedRecommendation?: string | undefined;
}>, {
    reason: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation";
    rejectNote?: string | undefined;
    correctedDiagnosis?: string | undefined;
    evidenceRequest?: {
        questions: {
            text: string;
            key: string;
            answer: string;
        }[];
        photoTypes: string[];
    } | undefined;
    customRecommendation?: {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    } | undefined;
    editedRecommendation?: string | undefined;
}, {
    reason: "wrong_diagnosis" | "need_more_evidence" | "recommendation_not_suitable" | "custom_recommendation";
    rejectNote?: string | undefined;
    correctedDiagnosis?: string | undefined;
    evidenceRequest?: {
        questions: {
            text: string;
            key: string;
            answer: string;
        }[];
        photoTypes: string[];
    } | undefined;
    customRecommendation?: {
        method: string;
        product: string;
        dose: string;
        reviewDate?: string | undefined;
    } | undefined;
    editedRecommendation?: string | undefined;
}>;
export type StructuredFieldVisitInput = z.infer<typeof structuredFieldVisitSchema>;
export type VisitAnalyzeRequest = z.infer<typeof visitAnalyzeRequestSchema>;
export declare const visitAnalyzeVisitRequestSchema: z.ZodObject<{
    farmerId: z.ZodString;
    blockId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
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
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
} & {
    fieldVoiceNote: z.ZodOptional<z.ZodString>;
    analyzePhotos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        dataBase64: z.ZodString;
        mimeType: z.ZodOptional<z.ZodString>;
        photoType: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        dataBase64: string;
        mimeType?: string | undefined;
        photoType?: string | undefined;
    }, {
        dataBase64: string;
        mimeType?: string | undefined;
        photoType?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    farmerId: string;
    blockId: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
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
    fieldVoiceNote?: string | undefined;
    analyzePhotos?: {
        dataBase64: string;
        mimeType?: string | undefined;
        photoType?: string | undefined;
    }[] | undefined;
}, {
    farmerId: string;
    blockId: string;
    latitude?: number | undefined;
    longitude?: number | undefined;
    sessionId?: string | undefined;
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
    fieldVoiceNote?: string | undefined;
    analyzePhotos?: {
        dataBase64: string;
        mimeType?: string | undefined;
        photoType?: string | undefined;
    }[] | undefined;
}>;
export type VisitAnalyzeVisitRequest = z.infer<typeof visitAnalyzeVisitRequestSchema>;
export declare const visitMonitoringPreviewSchema: z.ZodObject<{
    issues: z.ZodArray<z.ZodObject<{
        localId: z.ZodString;
        issueName: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high"]>;
    }, "strip", z.ZodTypeAny, {
        severity: "low" | "high" | "medium";
        issueName: string;
        localId: string;
    }, {
        severity: "low" | "high" | "medium";
        issueName: string;
        localId: string;
    }>, "many">;
    recommendationGroups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        applicationType: z.ZodString;
        applicationDay: z.ZodOptional<z.ZodNumber>;
        sortOrder: z.ZodOptional<z.ZodNumber>;
        materials: z.ZodArray<z.ZodObject<{
            issueIndex: z.ZodOptional<z.ZodNumber>;
            issueId: z.ZodOptional<z.ZodString>;
            category: z.ZodString;
            technicalName: z.ZodString;
            dose: z.ZodOptional<z.ZodString>;
            method: z.ZodOptional<z.ZodString>;
            relatedIssueIndex: z.ZodOptional<z.ZodNumber>;
            relatedIssueId: z.ZodOptional<z.ZodString>;
            sortOrder: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }, {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }, {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    issues: {
        severity: "low" | "high" | "medium";
        issueName: string;
        localId: string;
    }[];
    recommendationGroups?: {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }[] | undefined;
}, {
    issues: {
        severity: "low" | "high" | "medium";
        issueName: string;
        localId: string;
    }[];
    recommendationGroups?: {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }[] | undefined;
}>;
export declare const visitWhatsappPreviewSchema: z.ZodObject<{
    farmerId: z.ZodString;
    blockName: z.ZodOptional<z.ZodString>;
    recommendationGroups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        applicationType: z.ZodString;
        applicationDay: z.ZodOptional<z.ZodNumber>;
        sortOrder: z.ZodOptional<z.ZodNumber>;
        materials: z.ZodArray<z.ZodObject<{
            issueIndex: z.ZodOptional<z.ZodNumber>;
            issueId: z.ZodOptional<z.ZodString>;
            category: z.ZodString;
            technicalName: z.ZodString;
            dose: z.ZodOptional<z.ZodString>;
            method: z.ZodOptional<z.ZodString>;
            relatedIssueIndex: z.ZodOptional<z.ZodNumber>;
            relatedIssueId: z.ZodOptional<z.ZodString>;
            sortOrder: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }, {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }, {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }>, "many">>;
    reviewDate: z.ZodOptional<z.ZodString>;
    monitoringInterval: z.ZodOptional<z.ZodString>;
    issues: z.ZodArray<z.ZodObject<{
        issueName: z.ZodString;
        finalDiagnosis: z.ZodOptional<z.ZodString>;
        finalRecommendation: z.ZodOptional<z.ZodString>;
        initialRecommendation: z.ZodOptional<z.ZodObject<{
            text: z.ZodString;
            dose: z.ZodOptional<z.ZodString>;
            method: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            method?: string | undefined;
            dose?: string | undefined;
        }, {
            text: string;
            method?: string | undefined;
            dose?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        issueName: string;
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        initialRecommendation?: {
            text: string;
            method?: string | undefined;
            dose?: string | undefined;
        } | undefined;
    }, {
        issueName: string;
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        initialRecommendation?: {
            text: string;
            method?: string | undefined;
            dose?: string | undefined;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    issues: {
        issueName: string;
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        initialRecommendation?: {
            text: string;
            method?: string | undefined;
            dose?: string | undefined;
        } | undefined;
    }[];
    farmerId: string;
    blockName?: string | undefined;
    reviewDate?: string | undefined;
    monitoringInterval?: string | undefined;
    recommendationGroups?: {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }[] | undefined;
}, {
    issues: {
        issueName: string;
        finalDiagnosis?: string | undefined;
        finalRecommendation?: string | undefined;
        initialRecommendation?: {
            text: string;
            method?: string | undefined;
            dose?: string | undefined;
        } | undefined;
    }[];
    farmerId: string;
    blockName?: string | undefined;
    reviewDate?: string | undefined;
    monitoringInterval?: string | undefined;
    recommendationGroups?: {
        applicationType: string;
        materials: {
            category: string;
            technicalName: string;
            method?: string | undefined;
            sortOrder?: number | undefined;
            dose?: string | undefined;
            issueIndex?: number | undefined;
            issueId?: string | undefined;
            relatedIssueIndex?: number | undefined;
            relatedIssueId?: string | undefined;
        }[];
        sortOrder?: number | undefined;
        applicationDay?: number | undefined;
    }[] | undefined;
}>;
export type VisitAiAnswersBody = z.infer<typeof visitAiAnswersBodySchema>;
export type VisitAiRejectBody = z.infer<typeof visitAiRejectBodySchema>;
//# sourceMappingURL=validators.d.ts.map