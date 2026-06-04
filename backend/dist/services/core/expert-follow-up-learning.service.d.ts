import type { AdvisoryLanguage } from '../ai/types.js';
import type { FollowUpQuestionKind, FollowUpChoiceOption } from '../whatsapp/pipeline/follow-up-question.types.js';
export type SavedFollowUpQuestion = {
    libraryId: string;
    id: string;
    kind: FollowUpQuestionKind;
    textEn: string;
    textMl: string;
    choices: FollowUpChoiceOption[];
    purpose?: string;
    sequenceOrder: number;
    issueLabel: string;
    symptomKey: string;
};
export type CaseReviewFollowUpInput = {
    sessionId: string;
    recommendationId?: string | null;
    farmerId: string;
    cropType: string;
    district: string | null;
    symptomsText: string;
    issueLabel: string;
    expertNotes?: string | null;
    verifiedBy: string;
    /** Q&A already collected from WhatsApp intake for this case */
    intakeQa?: Array<{
        question: string;
        answer: string;
        kind?: string;
    }>;
};
declare function symptomKeysForText(cropType: string, symptomsText: string, issueLabel?: string): string[];
export declare const expertFollowUpLearningService: {
    symptomKeysForText: typeof symptomKeysForText;
    localize(q: SavedFollowUpQuestion, lang: AdvisoryLanguage): string;
    findForFarmer(params: {
        cropType: string;
        district: string | null;
        symptomsText: string;
        issueLabelHint?: string;
        language: AdvisoryLanguage;
        max?: number;
    }): Promise<SavedFollowUpQuestion[]>;
    recordHit(libraryId: string): Promise<void>;
    persistQuestions(params: {
        cropType: string;
        district: string | null;
        symptomKey: string;
        issueLabel: string;
        questions: Array<{
            questionId: string;
            kind: FollowUpQuestionKind;
            textEn: string;
            textMl: string;
            choices: FollowUpChoiceOption[];
            purpose?: string;
            sequenceOrder: number;
        }>;
        sourceSessionId?: string;
        sourceRecommendationId?: string;
        verifiedBy: string;
    }): Promise<number>;
    generateQuestionsForCase(input: CaseReviewFollowUpInput): Promise<Array<{
        questionId: string;
        kind: FollowUpQuestionKind;
        textEn: string;
        textMl: string;
        choices: FollowUpChoiceOption[];
        purpose?: string;
    }>>;
    onCaseReviewApproved(input: CaseReviewFollowUpInput): Promise<{
        saved: number;
    }>;
    loadIntakeQaFromSession(sessionId: string): Promise<Array<{
        question: string;
        answer: string;
        kind?: string;
    }>>;
};
export {};
//# sourceMappingURL=expert-follow-up-learning.service.d.ts.map