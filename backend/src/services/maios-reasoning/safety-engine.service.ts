import type { CropKnowledgePackage } from '../../domain/maios-reasoning/types.js';
import type {
  SafetyValidationResult,
  ScientificManagementPlan,
} from '../../domain/maios-reasoning/management-types.js';

export type SafetyValidationInput = {
  pkg: CropKnowledgePackage;
  management: ScientificManagementPlan | null;
  dap?: number | null;
  contextPack?: {
    heavyRainLikely?: boolean;
    highHeatLikely?: boolean;
  };
  chemicalClasses?: string[];
  harvestWithinDays?: number | null;
};

/** Domain 9 — validate management plan against crop stage, weather, PHI/REI rules. */
export const maiosSafetyEngineService = {
  validate(input: SafetyValidationInput): SafetyValidationResult {
    const rules = input.pkg.safetyRules ?? [];
    const checks: SafetyValidationResult['checks'] = [];
    const rejectReasons: string[] = [];

    if (!input.management) {
      return { status: 'PASS', checks: [], rejectReasons: [] };
    }

    for (const rule of rules) {
      let passed = true;
      let reason = 'OK';

      if (rule.condition === 'heavy_rain_forecast' && input.contextPack?.heavyRainLikely) {
        const hasFoliar = input.management.chemical.some((c) =>
          /strobilurin|triazole|spinosyn|foliar|dmi|qoi/i.test(c.notes + c.activeIngredientClass)
        );
        if (hasFoliar) {
          passed = false;
          reason = rule.rejectReason;
        }
      }

      if (rule.condition === 'high_heat' && input.contextPack?.highHeatLikely) {
        const hasFoliarFungicide = input.management.chemical.some((c) =>
          /strobilurin|triazole|fungicide|dmi|qoi/i.test(c.activeIngredientClass + c.notes)
        );
        if (hasFoliarFungicide) {
          passed = false;
          reason = rule.rejectReason;
        }
      }

      if (rule.condition === 'harvest_within_7d' && (input.harvestWithinDays ?? 999) <= 7) {
        if (input.management.chemical.length > 0) {
          passed = false;
          reason = rule.rejectReason;
        }
      }

      if (rule.condition === 'early_germination' && input.dap != null && input.dap < 21) {
        if (input.management.chemical.length > 0) {
          passed = false;
          reason = rule.rejectReason;
        }
      }

      checks.push({ ruleId: rule.id, passed, reason });
      if (!passed) rejectReasons.push(reason);
    }

    return {
      status: rejectReasons.length ? 'REJECT' : 'PASS',
      checks,
      rejectReasons,
    };
  },
};
