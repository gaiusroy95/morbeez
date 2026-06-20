import type { RecommendationPriority, VisitAiAnswerType, VisitAiQuestion } from '../types/field-findings';

/** Injectable visit AI client for agronomist vs partner visit wizard steps. */
export type VisitAiClient = {
  getVisitAiQuestions(aiCaseId: string): Promise<VisitAiQuestion[]>;
  skipVisitAiFollowUp(aiCaseId: string): Promise<{ ok: boolean; skipped: boolean }>;
  saveVisitAiAnswers(
    aiCaseId: string,
    answers: Array<{ questionId: string; answer: string }>
  ): Promise<unknown>;
  syncVisitAiQuestions(
    aiCaseId: string,
    questions: Array<{
      id?: string;
      questionText: string;
      answer?: string;
      answerType?: VisitAiAnswerType;
    }>
  ): Promise<VisitAiQuestion[]>;
  regenerateVisitAiQuestions(aiCaseId: string): Promise<VisitAiQuestion[]>;
  reanalyzeVisitAiCase(aiCaseId: string): Promise<{
    ok: boolean;
    finalDiagnosis: string;
    confidenceAction?: string;
    hypotheses?: Array<{ label: string; confidence?: number; rationale?: string }>;
  }>;
  recommendVisitAiCase(
    aiCaseId: string,
    finalDiagnosis?: string
  ): Promise<{
    ok: boolean;
    recommendationId: string;
    text: string;
    dosage: string | null;
    priority: string;
    reviewAfterDays: number;
    reviewDate?: string;
    expectedImprovementDays?: string;
  }>;
};

export type { RecommendationPriority };
