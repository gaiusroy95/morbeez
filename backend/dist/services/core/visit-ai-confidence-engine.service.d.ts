import { type EvidenceDelta, type HypothesisDistribution } from '../../domain/visit-ai/confidence-distribution.js';
export type ConfidenceState = {
    distribution: HypothesisDistribution;
    thresholdReached: boolean;
    topLabel: string | null;
    confidenceAction: string;
    nextQuestion: {
        id: string;
        questionText: string;
        answerType: string;
    } | null;
};
export declare const visitAiConfidenceEngineService: {
    getConfidenceState(aiCaseId: string): Promise<ConfidenceState>;
    initializeFromHypotheses(aiCaseId: string, hypotheses: Array<{
        label: string;
        confidence: number;
    }>): Promise<ConfidenceState>;
    applyAnswer(aiCaseId: string, questionId: string, answer: string): Promise<ConfidenceState & {
        deltas: EvidenceDelta[];
    }>;
};
//# sourceMappingURL=visit-ai-confidence-engine.service.d.ts.map