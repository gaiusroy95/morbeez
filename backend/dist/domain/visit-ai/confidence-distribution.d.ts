export type HypothesisWeight = {
    label: string;
    weight: number;
};
export type HypothesisDistribution = {
    hypotheses: HypothesisWeight[];
    unknownWeight: number;
    topConfidence: number;
    targetConfidence: number;
};
export declare const DEFAULT_TARGET_CONFIDENCE = 0.85;
/** Normalize raw scores (0–1 or 0–100) into integer percents summing to 100 with unknown bucket. */
export declare function buildHypothesisDistribution(raw: Array<{
    label: string;
    confidence?: number;
    weight?: number;
}>, targetConfidence?: number): HypothesisDistribution;
export declare function distributionThresholdReached(dist: HypothesisDistribution): boolean;
export type EvidenceDelta = {
    label: string;
    delta: number;
};
export declare function applyEvidenceDeltas(dist: HypothesisDistribution, deltas: EvidenceDelta[]): HypothesisDistribution;
//# sourceMappingURL=confidence-distribution.d.ts.map