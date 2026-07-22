/** Strip punctuation and collapse whitespace (keeps letters/numbers in any script). */
export declare function normalizeQuestionText(text: string): string;
export declare function buildSymptomKey(...parts: (string | undefined)[]): string;
/**
 * Order-independent key — "yellow spots ginger" and "ginger yellow spots" match.
 */
export declare function buildLooseSymptomKey(...parts: (string | undefined)[]): string;
/** All lookup/index keys to try for one farmer utterance. */
export declare function buildQuestionReuseKeys(parts: {
    text: string;
    voiceTranscript?: string;
    compactHistory?: string;
    issueLabelHint?: string | null;
    intentSlug?: string | null;
}): string[];
//# sourceMappingURL=question-reuse-keys.util.d.ts.map