import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { MaiosModuleScore, MaiosTriageLevel } from '../../domain/case/types.js';
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
export declare const moduleFusionService: {
    buildModuleScores(input: ModuleInput): MaiosModuleScore[];
    fusedConfidence(modules: MaiosModuleScore[], modelConfidence: number, plantId?: PlantIdHealthResult | null): number;
    triageLevel(params: {
        severity?: "mild" | "moderate" | "severe";
        fusedConfidence: number;
        riskTagCount: number;
        probableIssue?: string;
        rootStressPattern?: string;
    }): {
        level: MaiosTriageLevel;
        reason: string;
    };
};
export {};
//# sourceMappingURL=module-fusion.service.d.ts.map