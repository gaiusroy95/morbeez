import type { AdvisoryLanguage } from '../ai/types.js';
export type ReviewSeverity = 'mild' | 'moderate' | 'severe';
export declare function textsLikelySame(a: string | null | undefined, b: string | null | undefined): boolean;
export declare function pickLatestOutput(outputs: unknown[] | null | undefined): Record<string, unknown> | undefined;
export declare function resolveFarmerQuestion(sessionRow: Record<string, unknown> | null): string;
export declare function pickFarmerFacingSummary(output: Record<string, unknown> | undefined, language: AdvisoryLanguage): string;
export declare function resolveProbableIssue(output: Record<string, unknown> | undefined, sessionProbable: string | null | undefined, farmerQuestion: string): string | null;
export declare function mapRecordSeverityToUi(severity: string | null | undefined): ReviewSeverity | undefined;
export declare function mapUiSeverityToRecord(severity: ReviewSeverity | undefined): 'low' | 'medium' | 'high' | null;
export declare function parseEscalationCorrection(raw: unknown): {
    action?: string;
    correctDiagnosis?: string | null;
    severity?: ReviewSeverity | null;
    recommendationId?: string | null;
} | null;
//# sourceMappingURL=case-review-inquiry.util.d.ts.map