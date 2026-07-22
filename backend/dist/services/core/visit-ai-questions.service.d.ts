import { maxQuestionsForConfidence } from '../../domain/visit-ai/question-count.js';
import { isHighValueVisitQuestion, type VisitQuestionAnswerType } from '../../domain/visit-ai/question-quality.js';
import type { VisitAiContextPack } from './visit-ai-context.service.js';
import type { VisitImageSignal } from './visit-ai-image.service.js';
import type { FollowUpQuestionKind } from '../whatsapp/pipeline/follow-up-question.types.js';
export type VisitFollowUpQuestionDraft = {
    questionText: string;
    answerType: VisitQuestionAnswerType;
    sourceLibraryId?: string;
    kind?: FollowUpQuestionKind;
    purpose?: string;
    priority?: number;
    options?: string[];
    imageTarget?: string;
};
export type VisitHypothesisHint = {
    label: string;
    confidence: number;
    rationale?: string;
};
export type VisitEvidenceHint = {
    photoSummary?: string;
    measurementSummary?: string;
    soilSummary?: string;
    weatherSummary?: string;
};
declare function normalizeAnswerType(raw: string | undefined): VisitQuestionAnswerType;
export declare const visitAiQuestionsService: {
    maxQuestionsForConfidence: typeof maxQuestionsForConfidence;
    isHighValueVisitQuestion: typeof isHighValueVisitQuestion;
    normalizeAnswerType: typeof normalizeAnswerType;
    buildVisitFollowUpQuestions(params: {
        farmerId: string;
        cropType: string;
        issueCategory: string;
        selectedHypothesis: string;
        observation?: string;
        context: VisitAiContextPack;
        imageSignal?: Pick<VisitImageSignal, "label" | "confidence" | "observations"> | null;
        photoCount?: number;
        hypotheses?: VisitHypothesisHint[];
        evidence?: VisitEvidenceHint;
        topConfidence?: number;
        max?: number;
    }): Promise<VisitFollowUpQuestionDraft[]>;
};
export {};
//# sourceMappingURL=visit-ai-questions.service.d.ts.map