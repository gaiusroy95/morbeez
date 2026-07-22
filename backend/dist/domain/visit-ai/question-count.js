/** Map diagnostic confidence to max high-value follow-up questions. */
export function maxQuestionsForConfidence(confidence) {
    const c = Math.min(1, Math.max(0, confidence));
    if (c >= 0.95)
        return 0;
    if (c >= 0.9)
        return 1;
    if (c >= 0.85)
        return 2;
    if (c >= 0.75)
        return 3;
    return 5;
}
//# sourceMappingURL=question-count.js.map