export type VisitQuestionAnswerType = 'yes_no_unknown' | 'text' | 'number';

const GENERIC_QUESTION_RE =
  /what measures|samples? (been )?collected|additional observations?|any other (issues|problems)|describe the symptoms|what specific symptoms|symptoms have you observed|suggest fungal|suggest (a |an )?(fungal|bacterial|nutrient)|general condition|overall health|what (are|is) the symptoms|tell me about/i;

const OPEN_ENDED_RE = /^(what|which|how|describe|list|explain|tell)\b/i;

const YES_NO_START_RE = /^(are|is|was|were|did|does|do|can|could|have|has|any)\b/i;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Reject generic or mismatched follow-up questions before showing to agronomists. */
export function isHighValueVisitQuestion(
  text: string,
  answerType: VisitQuestionAnswerType
): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 10) return false;
  if (GENERIC_QUESTION_RE.test(trimmed)) return false;
  if (wordCount(trimmed) > 20) return false;
  if (answerType === 'yes_no_unknown') {
    if (OPEN_ENDED_RE.test(trimmed)) return false;
    if (!YES_NO_START_RE.test(trimmed) && !/\?$/.test(trimmed)) return false;
  }
  return true;
}

export function visitQuestionsNeedRegeneration(
  questions: Array<{ questionText: string; answerType: VisitQuestionAnswerType; answer?: string }>,
  maxAllowed: number
): boolean {
  if (!questions.length) return true;
  const answered = questions.filter((q) => q.answer?.trim());
  if (answered.length) {
    return questions.some((q) => !isHighValueVisitQuestion(q.questionText, q.answerType));
  }
  if (questions.length > maxAllowed) return true;
  return questions.some((q) => !isHighValueVisitQuestion(q.questionText, q.answerType));
}
