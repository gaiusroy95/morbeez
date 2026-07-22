import type { GingerModuleScore, GingerTriageLevel } from '../../domain/ginger-sop/types.js';
import type { PlantIdHealthResult } from '../ai/types.js';
type ModuleInput = {
    evidenceCompleteness: number;
    hasBlockId: boolean;
    hasSoilReport: boolean;
    hasWaterData: boolean;
    hasInputHistory: boolean;
    hasRootPhoto: boolean;
    hasFieldMetrics: boolean;
    hasCanopyAudit: boolean;
    canopyModuleScore?: number;
    intakeMatchConfidence?: number;
    modelConfidence: number;
    plantId?: PlantIdHealthResult | null;
};
export declare const gingerSopConfidenceService: {
    buildModuleScores(input: ModuleInput): GingerModuleScore[];
    /** Weighted fusion — only modules with completeness > 0 contribute. */
    fusedConfidence(modules: GingerModuleScore[], modelConfidence: number, plantId?: PlantIdHealthResult | null): number;
    triageLevel(params: {
        severity?: "mild" | "moderate" | "severe";
        fusedConfidence: number;
        riskTagCount: number;
        probableIssue?: string;
    }): {
        level: GingerTriageLevel;
        reason: string;
    };
};
export {};
//# sourceMappingURL=ginger-sop-confidence.service.d.ts.map