import type { ReviewAction } from '../../domain/ai-training/enums.js';
import type { VisitAiRejectBody, VisitAnalyzeRequest, VisitAnalyzeVisitRequest, VisitAiAnswersBody } from '../../domain/ai-training/validators.js';
type HypothesisRow = {
    label: string;
    confidence: number;
    rationale?: string;
    selected?: boolean;
    imagePrediction?: string;
    imageConfidence?: number;
};
export declare const visitAiOrchestratorService: {
    buildContext: (input: {
        farmerId: string;
        blockId: string;
        sessionId?: string;
        blockAssessment?: {
            blockHealth: import("../../domain/ai-training/enums.js").BlockHealthLevel;
            cropPerformance: import("../../domain/ai-training/enums.js").CropPerformanceLevel;
            soilMoisture: import("../../domain/ai-training/enums.js").SoilMoistureLevel;
        };
        measurements?: Array<{
            key: string;
            value: string;
            unit?: string;
        }>;
        latitude?: number;
        longitude?: number;
        fieldVoiceNote?: string;
    }) => Promise<import("./visit-ai-context.service.js").VisitAiContextPack>;
    analyze(input: VisitAnalyzeRequest, agronomistEmail: string): Promise<{
        aiCaseId: string;
        hypotheses: {
            label: string;
            confidence: number;
            rationale: string | undefined;
            selected: boolean;
            imagePrediction: string | undefined;
            imageConfidence: number | undefined;
        }[];
        confidenceAction: "auto_send" | "employee_review" | "escalate";
        skipFollowUpOptional: boolean;
        imageSignal: {
            label: string;
            confidence: number;
        } | null;
        similarCases: {
            issueLabel: string;
            score: number;
            confidence: number;
            outcome: string | null;
        }[];
    }>;
    skipFollowUp(aiCaseId: string): Promise<{
        skipped: boolean;
    }>;
    getCaseDetail(aiCaseId: string): Promise<{
        id: string;
        category: string;
        issueName: string;
        finalDiagnosis: string | null;
        finalConfidence: number | null;
        confidenceAction: string | null;
        status: string;
        metadata: Record<string, unknown>;
        fieldFindingId: string | null;
        visitedAt: string | null;
        hypotheses: {
            label: string;
            confidence: number;
            rationale: string | undefined;
            selected: boolean;
            imagePrediction: string | undefined;
            imageConfidence: number | undefined;
        }[];
        questions: {
            id: string;
            questionText: string;
            answerType: "yes_no_unknown" | "text" | "number";
            answer: string | undefined;
        }[];
        recommendations: {
            aiText: string;
            humanText: string | null;
            reviewAction: string | null;
            reviewAfterDays: number | null;
        }[];
    }>;
    getQuestions(aiCaseId: string): Promise<{
        id: string;
        questionText: string;
        answerType: "yes_no_unknown" | "text" | "number";
    }[]>;
    saveAnswers(aiCaseId: string, body: VisitAiAnswersBody): Promise<{
        saved: number;
    }>;
    reanalyze(aiCaseId: string): Promise<{
        finalDiagnosis: string;
        finalConfidence: number;
        confidenceAction: "auto_send" | "employee_review" | "escalate";
        hypotheses: HypothesisRow[];
    }>;
    recommend(aiCaseId: string, finalDiagnosis?: string): Promise<{
        recommendationId: string;
        text: string;
        dosage: string | null;
        priority: "high" | "normal" | "critical";
        reviewAfterDays: number;
        reviewDate: string;
        expectedImprovementDays: string;
    }>;
    analyzeVisit(input: VisitAnalyzeVisitRequest, agronomistEmail: string): Promise<{
        issues: {
            localId: string;
            category: string;
            issueName: string;
            confidence: number;
            aiConfidence: number;
            severity: "low" | "high" | "medium";
            observation: string;
            aiCaseId: string;
            hypotheses: {
                label: string;
                confidence: number;
                rationale: string | undefined;
                selected: boolean;
                imagePrediction: string | undefined;
                imageConfidence: number | undefined;
            }[];
            selectedHypothesisLabel: string;
            finalDiagnosis: string;
            finalRecommendation: undefined;
            confidenceAction: "auto_send" | "employee_review" | "escalate";
            skipFollowUpOptional: boolean;
            imageSignal: {
                label: string;
                confidence: number;
            } | undefined;
            similarCases: {
                issueLabel: string;
                score: number;
                confidence: number;
                outcome: string | null;
            }[];
            rootCause: {
                symptoms: string[];
                photoSignals: string[];
                soilSignals: string[];
                weatherSignals: string[];
                conclusion: string;
            };
            evidence: {
                photoSummary: string;
                measurementSummary: string;
                soilSummary: string;
                weatherSummary: string;
                historySummary: string;
            };
            initialRecommendation: {
                text: string;
                dose: undefined;
                method: string;
                category: string;
            } | undefined;
        }[];
    }>;
    similarCases(farmerId: string, cropType: string, issueName: string): Promise<{
        issueLabel: string;
        score: number;
        confidence: number;
        outcome: string | null;
    }[]>;
    searchCaseLibrary(params: {
        cropType?: string;
        issue?: string;
        outcome?: string;
        dapBucket?: string;
        severity?: string;
        reviewAction?: string;
        limit?: number;
    }): Promise<{
        id: string;
        category: string;
        issueName: string;
        finalDiagnosis: string | null;
        confidence: number | null;
        visitedAt: string;
        reviewAction: string | null;
        fieldFindingId: string | null;
        dap: number | null;
        dapBucket: number | null;
        severity: string | null;
        outcome: string | null;
        cropType: string | null;
    }[]>;
    mapReviewToTrainingAction(action: ReviewAction): ReviewAction;
    rejectRecommendation(aiCaseId: string, body: VisitAiRejectBody, agronomistEmail: string): Promise<{
        status: "diagnosis_confirmed";
        finalDiagnosis: string;
        finalRecommendation: string;
        dosage: string | null;
        reviewAfterDays: number;
        reviewAction: "correct_ai";
        whatsappSent?: undefined;
        customRecommendation?: undefined;
    } | {
        status: "waiting_farmer_response";
        whatsappSent: boolean;
        reviewAction: "reject_recommendation";
        finalDiagnosis?: undefined;
        finalRecommendation?: undefined;
        dosage?: undefined;
        reviewAfterDays?: undefined;
        customRecommendation?: undefined;
    } | {
        status: "recommendation_confirmed";
        finalRecommendation: string;
        reviewAction: "partial_match";
        finalDiagnosis?: undefined;
        dosage?: undefined;
        reviewAfterDays?: undefined;
        whatsappSent?: undefined;
        customRecommendation?: undefined;
    } | {
        status: "recommendation_confirmed";
        finalRecommendation: string;
        dosage: string;
        reviewAction: "correct_ai";
        customRecommendation: {
            method: string;
            product: string;
            dose: string;
            reviewDate?: string | undefined;
        };
        finalDiagnosis?: undefined;
        reviewAfterDays?: undefined;
        whatsappSent?: undefined;
    }>;
    linkCaseToVisitIssue(aiCaseId: string, fieldFindingId: string, visitIssueId: string): Promise<void>;
};
export {};
//# sourceMappingURL=visit-ai-orchestrator.service.d.ts.map