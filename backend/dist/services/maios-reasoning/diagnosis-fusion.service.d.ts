import type { DifferentialDiagnosisItem, StructuredAdvisory } from '../ai/types.js';
import type { MaiosReasoningSnapshot, PosteriorEntry } from '../../domain/maios-reasoning/types.js';
export type FusedCandidate = {
    label: string;
    posterior?: number;
    llmProbability?: number;
    llmPrimary: boolean;
    fusedScore: number;
};
export declare function normalizeDiagnosisLabel(label: string): string;
/** Fuzzy label match — no crop-specific disease names. */
export declare function diagnosisLabelsMatch(a: string, b: string): boolean;
export declare function buildFusedCandidates(params: {
    posterior: PosteriorEntry[];
    advisory: StructuredAdvisory;
    bayesianLocked?: boolean;
    topPosteriorLabel?: string;
}): FusedCandidate[];
export declare function pickFusedPrimary(params: {
    candidates: FusedCandidate[];
    reasoning: MaiosReasoningSnapshot;
    advisory: StructuredAdvisory;
}): {
    label: string;
    confidence: number;
};
export declare function alternativesBelowPrimary(primaryLabel: string, items: DifferentialDiagnosisItem[]): DifferentialDiagnosisItem[];
//# sourceMappingURL=diagnosis-fusion.service.d.ts.map