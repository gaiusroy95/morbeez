import { economicGateService } from '../case/economic-gate.service.js';
import { outcomeIntelligenceService } from '../intelligence/outcome-intelligence.service.js';

export type RecommendationOption = {
  id: string;
  label: string;
  costInr: number;
  expectedRecoveryPct: number;
  roiNote: string;
  proceed: boolean;
};

export const recommendationOptimizerService = {
  async buildOptions(input: {
    issueLabel: string;
    cropType: string;
    farmerSegment?: 'premium' | 'roi_focused' | 'low_budget';
    baseProtocols?: Array<{ label: string; costInr: number; materials?: string[] }>;
  }): Promise<RecommendationOption[]> {
    const stats = await outcomeIntelligenceService.aggregateByIssue(input.issueLabel, 10);
    const recoveryByProtocol = new Map(stats.map((s) => [s.protocolLabel.toLowerCase(), s.recoveryPct]));

    const defaults = input.baseProtocols?.length
      ? input.baseProtocols
      : [
          { label: 'Standard protocol', costInr: 4200 },
          { label: 'Balanced protocol', costInr: 2800 },
          { label: 'Economy protocol', costInr: 1400 },
        ];

    const segment = input.farmerSegment ?? 'roi_focused';

    return defaults.map((p, i) => {
      const recovery =
        recoveryByProtocol.get(p.label.toLowerCase()) ??
        Math.max(65, 92 - i * 4 - Math.round(p.costInr / 500));
      const benefit = (recovery / 100) * p.costInr * 2.5;
      const gate = economicGateService.assess({
        treatmentCostInr: p.costInr,
        expectedBenefitInr: benefit,
      });
      let roiNote = gate.reason;
      if (segment === 'premium' && recovery >= 88) roiNote = 'Best recovery — premium segment fit';
      if (segment === 'low_budget' && p.costInr <= 2000) roiNote = 'Lowest cost — budget segment fit';
      if (segment === 'roi_focused' && gate.roi != null && gate.roi >= 0.5)
        roiNote = 'Strong ROI for this segment';

      return {
        id: `opt-${i}`,
        label: p.label,
        costInr: p.costInr,
        expectedRecoveryPct: recovery,
        roiNote,
        proceed: gate.proceed,
      };
    });
  },
};
