import type { QualificationAnswers, QualificationResult } from './types.js';
/** Rule-based lead score. Missing fields stay COLD rather than inventing data. */
export declare function scoreQualification(answers: QualificationAnswers): QualificationResult;
export declare function parseAcres(raw: string | null | undefined): number | null;
export declare function parseCropAgeDays(raw: string | null | undefined): number | null;
//# sourceMappingURL=qualification-score.d.ts.map