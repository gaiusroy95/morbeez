/** Deterministic specificity scoring for scoped terminology / alias rows. */
export type ScopedLexiconRow = {
    cropType?: string | null;
    district?: string | null;
    confidence?: number | null;
};
export type LexiconScope = {
    cropType?: string | null;
    district?: string | null;
};
/**
 * Higher is better. Negative means the row is out of scope for the request.
 * Tiers: district+crop (100+) → district (80+) → crop (60+) → language-global (40+).
 */
export declare function lexiconSpecificityScore(row: ScopedLexiconRow, scope: LexiconScope): number;
export declare function pickBestScopedRow<T extends ScopedLexiconRow>(rows: T[], scope: LexiconScope): T | null;
export declare function normalizeScopeKey(value?: string | null): string;
export declare function normalizeLexiconToken(token: string): string;
//# sourceMappingURL=terminology-match.util.d.ts.map