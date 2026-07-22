import type { CropKnowledgePackage } from '../../domain/maios-reasoning/types.js';
import type { SafetyValidationResult, ScientificManagementPlan } from '../../domain/maios-reasoning/management-types.js';
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
export declare const maiosSafetyEngineService: {
    validate(input: SafetyValidationInput): SafetyValidationResult;
};
//# sourceMappingURL=safety-engine.service.d.ts.map