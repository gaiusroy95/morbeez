import type { VisitAiContextPack } from './visit-ai-context.service.js';
import type { VisitImageSignal } from './visit-ai-image.service.js';
import type { FollowUpQuestionKind } from '../whatsapp/pipeline/follow-up-question.types.js';
export type VisitFollowUpQuestionDraft = {
    questionText: string;
    answerType: 'yes_no_unknown' | 'text' | 'number';
    sourceLibraryId?: string;
    kind?: FollowUpQuestionKind;
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
export declare const visitAiQuestionsService: {
    buildVisitFollowUpQuestions(params: {
        farmerId: string;
        cropType: string;
        issueCategory: string;
        selectedHypothesis: string;
        observation?: string;
        context: VisitAiContextPack;
        imageSignal?: Pick<VisitImageSignal, "label" | "confidence"> | null;
        photoCount?: number;
        hypotheses?: VisitHypothesisHint[];
        evidence?: VisitEvidenceHint;
        max?: number;
    }): Promise<VisitFollowUpQuestionDraft[]>;
};
//# sourceMappingURL=visit-ai-questions.service.d.ts.map