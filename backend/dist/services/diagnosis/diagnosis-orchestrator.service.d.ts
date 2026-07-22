import type { VisitAnalyzeVisitRequest } from '../../domain/ai-training/validators.js';
import type { DiagnosisEnvelope, DiagnosisSource } from '../../domain/diagnosis/types.js';
import type { MaiosTriageLevel } from '../../domain/case/types.js';
export type TriagePreviewResult = {
    level: MaiosTriageLevel;
    reason: string;
    route: 'fast' | 'standard' | 'complex' | 'critical';
    mandatoryFollowUp: boolean;
    blockAutoApprove: boolean;
};
export declare const diagnosisOrchestratorService: {
    isCapable(): boolean;
    getCapabilityStatus(): {
        capable: boolean;
        diagnosisDegraded: boolean;
        openai: boolean;
        plantId: boolean;
    };
    triagePreview(input: VisitAnalyzeVisitRequest): Promise<TriagePreviewResult>;
    analyzeVisit(input: VisitAnalyzeVisitRequest, agronomistEmail: string): Promise<{
        issues: ({
            diagnosisSource: DiagnosisSource;
            diagnosisEnvelope: DiagnosisEnvelope;
            triage: TriagePreviewResult;
            localId: string;
            category: string;
            issueName: string;
            confidence: number;
            aiConfidence: number;
            severity: "high";
            observation: string;
            escalationRequired: boolean;
            rootCause: {
                symptoms: string[];
                photoSignals: string[];
                soilSignals: never[];
                weatherSignals: never[];
                conclusion: string;
            };
            evidence: {
                photoSummary: string;
                measurementSummary: string;
                soilSummary: string;
                weatherSummary: string;
                historySummary: string;
            };
        } | {
            diagnosisSource: DiagnosisSource;
            diagnosisEnvelope: DiagnosisEnvelope;
            triage: TriagePreviewResult;
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
        })[];
        triage: TriagePreviewResult;
        diagnosisDegraded: boolean;
        insufficientEvidence: boolean;
    } | {
        issues: ({
            diagnosisSource: DiagnosisSource;
            diagnosisEnvelope: DiagnosisEnvelope;
            triage: TriagePreviewResult;
            localId: string;
            category: string;
            issueName: string;
            confidence: number;
            aiConfidence: number;
            severity: "high";
            observation: string;
            escalationRequired: boolean;
            rootCause: {
                symptoms: string[];
                photoSignals: string[];
                soilSignals: never[];
                weatherSignals: never[];
                conclusion: string;
            };
            evidence: {
                photoSummary: string;
                measurementSummary: string;
                soilSummary: string;
                weatherSummary: string;
                historySummary: string;
            };
        } | {
            diagnosisSource: DiagnosisSource;
            diagnosisEnvelope: DiagnosisEnvelope;
            triage: TriagePreviewResult;
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
        })[];
        triage: TriagePreviewResult;
        diagnosisDegraded: boolean;
        insufficientEvidence?: undefined;
    } | {
        issues: never[];
        diagnosisDegraded: boolean;
        envelope: DiagnosisEnvelope;
    } | {
        diagnosisDegraded: boolean;
        issues: {
            localId: string;
            category: string;
            issueName: string;
            confidence: number;
            aiConfidence: number;
            severity: "high";
            observation: string;
            escalationRequired: boolean;
            diagnosisSource: DiagnosisSource;
            evidence: {
                photoSummary: string;
                measurementSummary: string;
                soilSummary: string;
                weatherSummary: string;
                historySummary: string;
            };
        }[];
        insufficientEvidence: boolean;
        envelope?: undefined;
    } | {
        diagnosisDegraded: boolean;
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
            diagnosisSource: DiagnosisSource;
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
            followUpQuestions: {
                id: string;
                questionText: string;
                answerType: import("../../domain/visit-ai/question-quality.js").VisitQuestionAnswerType;
                options?: string[];
                priority?: number;
                imageTarget?: string;
            }[];
            initialRecommendation: {
                text: string;
                method: string;
                category: string;
            } | undefined;
        }[];
        insufficientEvidence?: undefined;
        envelope?: undefined;
    }>;
    resolveSourceFromImage(hasModel: boolean, imageSource?: "plant_id" | "vision" | "fusion" | null): DiagnosisSource;
};
//# sourceMappingURL=diagnosis-orchestrator.service.d.ts.map