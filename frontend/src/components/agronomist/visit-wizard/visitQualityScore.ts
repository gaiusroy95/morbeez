import type { BlockHealthLevel, CropPerformanceLevel, SoilMoistureLevel } from '@morbeez/shared';

export function computeVisitQualityScore(input: {
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  photoCount: number;
  photoTypeCount?: number;
  filledMeasurements: number;
  requiredMeasurements: number;
  issueCount: number;
  recommendationCount: number;
  hasGps: boolean;
  qaAnsweredCount?: number;
  qaTotalCount?: number;
  hasReviewDecision?: boolean;
}): { score: number; label: string; message: string } {
  let score = 0;

  if (input.blockHealth && input.cropPerformance && input.soilMoisture) score += 20;

  if (input.photoCount >= 8) score += 15;
  else if (input.photoCount >= 4) score += 12;
  else if (input.photoCount > 0) score += 6;

  if ((input.photoTypeCount ?? 0) >= 4) score += 5;

  const required = Math.max(1, input.requiredMeasurements);
  score += Math.round(20 * Math.min(1, input.filledMeasurements / required));

  if (input.issueCount >= 2) score += 15;
  else if (input.issueCount === 1) score += 10;

  const qaTotal = input.qaTotalCount ?? 0;
  const qaAnswered = input.qaAnsweredCount ?? 0;
  if (qaTotal > 0) {
    score += Math.round(15 * Math.min(1, qaAnswered / qaTotal));
  } else {
    score += 5;
  }

  if (input.recommendationCount > 0) score += 8;
  if (input.hasReviewDecision) score += 7;
  if (input.hasGps) score += 5;

  score = Math.min(100, score);

  if (score >= 85) {
    return { score, label: 'Excellent', message: 'Great! This visit has high quality evidence for AI learning.' };
  }
  if (score >= 70) {
    return { score, label: 'Good', message: 'Solid visit data. Complete Q&A and review to improve.' };
  }
  if (score >= 50) {
    return { score, label: 'Fair', message: 'Add photos by type, measurements, and follow-up answers.' };
  }
  return { score, label: 'Needs improvement', message: 'Complete assessment, photos, AI steps, and review before submitting.' };
}
