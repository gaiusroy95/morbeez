import type { AdvisoryLanguage } from '../ai/types.js';
import type { ReviewSeverity } from '../../domain/ai-training/severity.js';
export type { ReviewSeverity } from '../../domain/ai-training/severity.js';
export { mapRecordSeverityToUi, mapUiSeverityToRecord, } from '../../domain/ai-training/severity.js';
export declare function textsLikelySame(a: string | null | undefined, b: string | null | undefined): boolean;
export declare function pickLatestOutput(outputs: unknown[] | null | undefined): Record<string, unknown> | undefined;
export declare function resolveFarmerQuestion(sessionRow: Record<string, unknown> | null): string;
export declare function pickFarmerFacingSummary(output: Record<string, unknown> | undefined, language: AdvisoryLanguage): string;
export declare function resolveProbableIssue(output: Record<string, unknown> | undefined, sessionProbable: string | null | undefined, farmerQuestion: string): string | null;
export declare function parseEscalationCorrection(raw: unknown): {
    action?: string;
    correctDiagnosis?: string | null;
    severity?: ReviewSeverity | null;
    recommendationId?: string | null;
} | null;
//# sourceMappingURL=case-review-inquiry.util.d.ts.map