import type { BlockHealthLevel, CropPerformanceLevel, SoilMoistureLevel } from '@morbeez/shared';

export function computeVisitQualityScore(input: {
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  photoCount: number;
  filledMeasurements: number;
  requiredMeasurements: number;
  issueCount: number;
  recommendationCount: number;
  hasGps: boolean;
}): { score: number; label: string; message: string } {
  let score = 0;

  if (input.blockHealth && input.cropPerformance && input.soilMoisture) score += 25;

  if (input.photoCount >= 8) score += 20;
  else if (input.photoCount >= 4) score += 15;
  else if (input.photoCount > 0) score += 8;

  const required = Math.max(1, input.requiredMeasurements);
  score += Math.round(25 * Math.min(1, input.filledMeasurements / required));

  if (input.issueCount >= 2) score += 20;
  else if (input.issueCount === 1) score += 12;

  if (input.recommendationCount > 0) score += 5;
  if (input.hasGps) score += 5;

  score = Math.min(100, score);

  if (score >= 85) {
    return { score, label: 'Excellent', message: 'Great! This visit has high quality data.' };
  }
  if (score >= 70) {
    return { score, label: 'Good', message: 'Solid visit data. Add photos or measurements to improve.' };
  }
  if (score >= 50) {
    return { score, label: 'Fair', message: 'Consider adding more photos and measurements.' };
  }
  return { score, label: 'Needs improvement', message: 'Complete assessment, photos, and issues before submitting.' };
}
