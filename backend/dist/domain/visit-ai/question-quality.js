export const VISIT_QUESTION_ANSWER_TYPES = [
    'yes_no_unknown',
    'yes_no',
    'single_choice',
    'multiple_choice',
    'percentage',
    'number',
    'text',
    'image_upload',
];
const GENERIC_QUESTION_RE = /what measures|samples? (been )?collected|additional observations?|any other (issues|problems)|describe the symptoms|what specific symptoms|symptoms have you observed|suggest fungal|suggest (a |an )?(fungal|bacterial|nutrient)|general condition|overall health|what (are|is) the symptoms|tell me about|anything else\b/i;
const OPEN_ENDED_RE = /^(what|which|how|describe|list|explain|tell)\b/i;
const YES_NO_START_RE = /^(are|is|was|were|did|does|do|can|could|have|has|any)\b/i;
const CHOICE_TYPES = [
    'single_choice',
    'multiple_choice',
    'percentage',
    'image_upload',
];
export function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}
/** Reject generic or mismatched follow-up questions before showing to agronomists. */
export function isHighValueVisitQuestion(text, answerType) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 8)
        return false;
    if (GENERIC_QUESTION_RE.test(trimmed))
        return false;
    // v12: ≤15 words (allow slight slack for legacy number/text)
    const maxWords = answerType === 'text' ? 20 : 15;
    if (wordCount(trimmed) > maxWords)
        return false;
    if (answerType === 'yes_no' || answerType === 'yes_no_unknown') {
        if (OPEN_ENDED_RE.test(trimmed))
            return false;
        if (!YES_NO_START_RE.test(trimmed) && !/\?$/.test(trimmed))
            return false;
    }
    if (answerType === 'text' && OPEN_ENDED_RE.test(trimmed) && GENERIC_QUESTION_RE.test(trimmed)) {
        return false;
    }
    if (CHOICE_TYPES.includes(answerType) && GENERIC_QUESTION_RE.test(trimmed)) {
        return false;
    }
    return true;
}
export function visitQuestionsNeedRegeneration(questions, maxAllowed) {
    if (!questions.length)
        return true;
    const answered = questions.filter((q) => q.answer?.trim());
    if (answered.length) {
        return questions.some((q) => !isHighValueVisitQuestion(q.questionText, q.answerType));
    }
    if (questions.length > maxAllowed)
        return true;
    return questions.some((q) => !isHighValueVisitQuestion(q.questionText, q.answerType));
}
//# sourceMappingURL=question-quality.js.map