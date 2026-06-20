import type { InvestigationContext } from './diagnosis-follow-up-reasoning.engine.js';
import { type FollowUpChoiceOption, type FollowUpQuestionKind } from './follow-up-question.types.js';
export type { FollowUpChoiceOption, FollowUpQuestionKind };
export type GeneratedFollowUpQuestion = {
    id: string;
    kind: FollowUpQuestionKind;
    text: string;
    choices: FollowUpChoiceOption[];
    purpose?: string;
};
export type LearnedInvestigationPattern = {
    initialSymptoms: string;
    issueLabel: string;
    qa: Array<{
        question: string;
        answer: string;
        kind?: string;
    }>;
};
export type PlanNextQuestionInput = {
    ctx: InvestigationContext;
    priorAnswers: Record<string, string>;
    questionTexts: Record<string, string>;
    questionsAsked: number;
    maxQuestions: number;
    learnedPatterns: LearnedInvestigationPattern[];
    /** MAIOS v12 — missing evidence slots from case (photo/module gaps) */
    evidenceGaps?: string[];
};
export type PostDiagnosisAdvisorySnapshot = {
    probableIssue: string;
    confidence: number;
    uncertain?: boolean;
    imageObservations?: string[];
    stressAnalysis?: string[];
    differentialDiagnosis?: Array<{
        label: string;
        reason: string;
        probability?: number;
    }>;
    rejectedHypotheses?: string[];
};
export type PlanPostDiagnosisQuestionInput = {
    ctx: InvestigationContext;
    advisory: PostDiagnosisAdvisorySnapshot;
    priorAnswers: Record<string, string>;
    questionTexts: Record<string, string>;
    questionsAsked: number;
    maxQuestions: number;
    learnedPatterns: LearnedInvestigationPattern[];
};
export type PlanNextQuestionResult = {
    intakeComplete: boolean;
    question?: GeneratedFollowUpQuestion;
    rationale?: string;
};
export declare const diagnosisFollowUpQuestionGenerator: {
    planNextQuestion(input: PlanNextQuestionInput): Promise<PlanNextQuestionResult>;
    planPostDiagnosisQuestion(input: PlanPostDiagnosisQuestionInput): Promise<PlanNextQuestionResult>;
    buildInvestigationPattern(params: {
        initialSymptoms: string;
        issueLabel: string;
        answers: Record<string, string>;
        questionTexts: Record<string, string>;
        questionKinds: Record<string, FollowUpQuestionKind>;
        questionChoices: Record<string, FollowUpChoiceOption[]>;
    }): LearnedInvestigationPattern;
};
//# sourceMappingURL=diagnosis-follow-up-question.generator.d.ts.map