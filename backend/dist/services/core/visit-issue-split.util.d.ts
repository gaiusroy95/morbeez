/** Detect distinct nutrient deficiencies mentioned in combined issue text. */
export declare function detectNutrientIds(text: string): string[];
export declare function shouldSplitNutrientIssue(issueName: string, conclusion?: string): boolean;
type SplittableIssue = {
    category: string;
    issueName: string;
    confidence: number;
    observation?: string;
    rootCause: {
        symptoms: string[];
        photoSignals: string[];
        soilSignals: string[];
        weatherSignals: string[];
        conclusion: string;
    };
    evidence: Record<string, string>;
};
/** Expand combined nutrient issues into one row per deficiency (never merge N+K). */
export declare function expandSeparateVisitIssues<T extends SplittableIssue>(issues: T[], maxIssues?: number): T[];
export {};
//# sourceMappingURL=visit-issue-split.util.d.ts.map