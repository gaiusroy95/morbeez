export type VisitQuestionAnswerType = 'yes_no_unknown' | 'yes_no' | 'single_choice' | 'multiple_choice' | 'percentage' | 'number' | 'text' | 'image_upload';
export declare const VISIT_QUESTION_ANSWER_TYPES: VisitQuestionAnswerType[];
export declare function wordCount(text: string): number;
/** Reject generic or mismatched follow-up questions before showing to agronomists. */
export declare function isHighValueVisitQuestion(text: string, answerType: VisitQuestionAnswerType): boolean;
export declare function visitQuestionsNeedRegeneration(questions: Array<{
    questionText: string;
    answerType: VisitQuestionAnswerType;
    answer?: string;
}>, maxAllowed: number): boolean;
//# sourceMappingURL=question-quality.d.ts.map