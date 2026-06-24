export type ConfidenceDistributionView = {
  hypotheses: Array<{ label: string; weight: number }>;
  unknownWeight: number;
  topConfidence: number;
  targetConfidence: number;
};

export const CONFIDENCE_TARGET_PERCENT = 85;

export function formatConfidenceProgress(dist: {
  topConfidence: number;
  targetConfidence: number;
}): { currentPercent: number; targetPercent: number; label: string } {
  const currentPercent = Math.round(dist.topConfidence * 100);
  const targetPercent = Math.round(dist.targetConfidence * 100);
  return {
    currentPercent,
    targetPercent,
    label: `Current confidence: ${currentPercent}% · Target: ≥${targetPercent}%`,
  };
}

export function confidenceThresholdMessage(dist: {
  topConfidence: number;
  targetConfidence: number;
}): string | null {
  if (dist.topConfidence >= dist.targetConfidence) {
    return 'Confidence threshold reached — proceed to AI diagnosis.';
  }
  return 'AI needs more evidence to improve confidence.';
}

export function distributionForDisplay(
  dist: ConfidenceDistributionView,
  partnerMode?: boolean
): ConfidenceDistributionView {
  if (!partnerMode) return dist;
  return {
    ...dist,
    hypotheses: dist.hypotheses.map((h) => ({ ...h, weight: 0 })),
    unknownWeight: 0,
  };
}
