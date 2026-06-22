import type { MaiosTriageLevel } from '../case/types.js';
/** How a diagnosis label was produced — required on every ranked hypothesis. */
export type DiagnosisSource = 'model' | 'vision' | 'verified_reuse' | 'insufficient_evidence';
export type DiagnosisHypothesis = {
    label: string;
    confidence: number;
    rationale: string;
    selected?: boolean;
    imagePrediction?: string;
    imageConfidence?: number;
};
export type DiagnosisEnvelope = {
    hypotheses: DiagnosisHypothesis[];
    source: DiagnosisSource;
    reusedFrom?: string;
    degraded: boolean;
    escalationRequired: boolean;
    evidenceSummary: string[];
    triage?: {
        level: MaiosTriageLevel;
        reason: string;
    };
};
export declare const INSUFFICIENT_EVIDENCE_LABEL = "Insufficient evidence for AI diagnosis";
export declare function isValidDiagnosisSource(source: DiagnosisSource): boolean;
//# sourceMappingURL=types.d.ts.map