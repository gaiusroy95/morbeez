import type { RecordSeverity, ReviewSeverity } from './enums.js';
export type { ReviewSeverity } from './enums.js';
/** Map DB record severity → UI review severity */
export declare function mapRecordSeverityToUi(severity: string | null | undefined): ReviewSeverity | undefined;
/** Map UI review severity → DB record severity */
export declare function mapUiSeverityToRecord(severity: ReviewSeverity | undefined): RecordSeverity | null;
export declare function isReviewSeverity(value: unknown): value is ReviewSeverity;
export declare function isRecordSeverity(value: unknown): value is RecordSeverity;
//# sourceMappingURL=severity.d.ts.map