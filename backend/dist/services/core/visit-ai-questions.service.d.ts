import type { VisitAiContextPack } from './visit-ai-context.service.js';
import type { FollowUpQuestionKind } from '../whatsapp/pipeline/follow-up-question.types.js';
export type VisitFollowUpQuestionDraft = {
    questionText: string;
    answerType: 'yes_no_unknown' | 'text' | 'number';
    sourceLibraryId?: string;
    kind?: FollowUpQuestionKind;
};
export declare const visitAiQuestionsService: {
    buildVisitFollowUpQuestions(params: {
        farmerId: string;
        cropType: string;
        issueCategory: string;
        selectedHypothesis: string;
        observation?: string;
        context: VisitAiContextPack;
        max?: number;
    }): Promise<VisitFollowUpQuestionDraft[]>;
};
//# sourceMappingURL=visit-ai-questions.service.d.ts.map