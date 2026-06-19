import type { MaiosHypothesis, MaiosModuleScore } from '../../domain/case/types.js';
type FusionInput = {
    modelConfidence: number;
    hasPlantId: boolean;
    moduleScores: MaiosModuleScore[];
};
export declare const multiModelFusionService: {
    enrichHypotheses(hypotheses: MaiosHypothesis[], input: FusionInput): {
        hypotheses: MaiosHypothesis[];
        modelAgreement: number;
    };
};
export {};
//# sourceMappingURL=multi-model-fusion.service.d.ts.map