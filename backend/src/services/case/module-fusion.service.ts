import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { MaiosModuleKey, MaiosModuleScore, MaiosTriageLevel } from '../../domain/case/types.js';
import { cropPackLoaderService } from '../crop-pack/crop-pack-loader.service.js';
import { computeConfidence } from '../ai/confidence.js';
import type { PlantIdHealthResult } from '../ai/types.js';

type ModuleInput = {
  pack: CropPackConfig;
  evidenceCompleteness: number;
  hasBlockId: boolean;
  hasSoilReport: boolean;
  hasWaterData: boolean;
  hasInputHistory: boolean;
  hasRootPhoto: boolean;
  hasFieldMetrics: boolean;
  hasCanopyAudit: boolean;
  hasLabReport?: boolean;
  hasRegionalData?: boolean;
  canopyModuleScore?: number;
  intakeMatchConfidence?: number;
  modelConfidence: number;
  plantId?: PlantIdHealthResult | null;
};

function moduleScore(
  pack: CropPackConfig,
  module: MaiosModuleKey,
  score: number,
  completeness: number,
  source: MaiosModuleScore['source']
): MaiosModuleScore {
  const weights = cropPackLoaderService.moduleWeights(pack);
  return {
    module,
    weight: weights[module] ?? 5,
    score: Math.round(score),
    completeness: Math.round(completeness),
    source,
  };
}

export const moduleFusionService = {
  buildModuleScores(input: ModuleInput): MaiosModuleScore[] {
    const photoScore = Math.min(95, input.evidenceCompleteness + (input.hasRootPhoto ? 15 : 0));
    const soilScore = input.hasSoilReport ? 88 : 25;
    const rootScore = input.hasRootPhoto ? 80 : input.evidenceCompleteness > 20 ? 35 : 10;
    const geoScore = input.hasBlockId ? 75 : 40;
    const weatherScore = 65;
    const historyScore = input.hasInputHistory ? 70 : 30;
    const waterScore = input.hasWaterData ? 72 : 20;
    const fieldScore = input.hasFieldMetrics ? 85 : 20;
    const canopyScore =
      input.canopyModuleScore ??
      (input.hasCanopyAudit ? 82 : input.evidenceCompleteness > 30 ? 45 : 15);
    const labScore = input.hasLabReport ? 85 : 15;
    const regionalScore = input.hasRegionalData ? 70 : 20;

    return [
      moduleScore(input.pack, 'geo', geoScore, input.hasBlockId ? 100 : 40, input.hasBlockId ? 'computed' : 'missing'),
      moduleScore(input.pack, 'photo', photoScore, input.evidenceCompleteness, 'computed'),
      moduleScore(input.pack, 'canopy', canopyScore, input.hasCanopyAudit ? 100 : 25, input.hasCanopyAudit ? 'computed' : 'missing'),
      moduleScore(input.pack, 'field', fieldScore, input.hasFieldMetrics ? 100 : 10, input.hasFieldMetrics ? 'human' : 'missing'),
      moduleScore(input.pack, 'root', rootScore, input.hasRootPhoto ? 100 : 15, input.hasRootPhoto ? 'computed' : 'missing'),
      moduleScore(input.pack, 'soil', soilScore, input.hasSoilReport ? 100 : 20, input.hasSoilReport ? 'computed' : 'missing'),
      moduleScore(input.pack, 'water', waterScore, input.hasWaterData ? 100 : 0, input.hasWaterData ? 'computed' : 'missing'),
      moduleScore(input.pack, 'history', historyScore, input.hasInputHistory ? 100 : 15, input.hasInputHistory ? 'computed' : 'missing'),
      moduleScore(input.pack, 'weather', weatherScore, 80, 'computed'),
      moduleScore(input.pack, 'lab', labScore, input.hasLabReport ? 100 : 0, input.hasLabReport ? 'computed' : 'missing'),
      moduleScore(input.pack, 'regional', regionalScore, input.hasRegionalData ? 100 : 10, input.hasRegionalData ? 'computed' : 'missing'),
    ];
  },

  fusedConfidence(
    modules: MaiosModuleScore[],
    modelConfidence: number,
    plantId?: PlantIdHealthResult | null
  ): number {
    const mergedModel = computeConfidence(modelConfidence, plantId);
    const active = modules.filter((m) => m.completeness > 0);
    if (!active.length) return mergedModel;

    let weightSum = 0;
    let scoreSum = 0;
    for (const m of active) {
      const effectiveWeight = m.weight * (m.completeness / 100);
      weightSum += effectiveWeight;
      scoreSum += (m.score / 100) * effectiveWeight;
    }

    const moduleFusion = weightSum > 0 ? scoreSum / weightSum : mergedModel;
    const fused = mergedModel * 0.45 + moduleFusion * 0.55;
    return Math.round(Math.min(0.98, Math.max(0.05, fused)) * 10000) / 10000;
  },

  triageLevel(params: {
    severity?: 'mild' | 'moderate' | 'severe';
    fusedConfidence: number;
    riskTagCount: number;
    probableIssue?: string;
    rootStressPattern?: string;
  }): { level: MaiosTriageLevel; reason: string } {
    const issue = (params.probableIssue ?? '').toLowerCase();
    const rootPat = params.rootStressPattern ?? 'root|rhizome|nematode|rot';
    if (/collapse|wilt|dead|മരണ|നശിച്ച/.test(issue) || params.severity === 'severe') {
      if (params.fusedConfidence < 0.55 || new RegExp(rootPat, 'i').test(issue)) {
        return { level: 'L4', reason: 'Severe/collapse symptoms with root or rot signals' };
      }
      return { level: 'L3', reason: 'Severe field symptoms — immediate review' };
    }
    if (params.severity === 'moderate' || params.riskTagCount >= 3) {
      return { level: 'L2', reason: 'Moderate symptoms or stacked environmental risks' };
    }
    return { level: 'L1', reason: 'Mild symptoms — standard diagnosis path' };
  },
};
