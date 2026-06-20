import type { MaiosHypothesis, MaiosModuleScore, MaiosLabReport } from '../../domain/case/types.js';
type FusionInput = {
    modelConfidence: number;
    hasPlantId: boolean;
    moduleScores: MaiosModuleScore[];
    regionalPriors?: Array<{
        issueLabel: string;
        caseCount: number;
    }>;
    kgCandidates?: Array<{
        label: string;
        relation: string;
        weight: number;
    }>;
    labReports?: MaiosLabReport[];
};
export declare const multiModelFusionService: {
    enrichHypotheses(hypotheses: MaiosHypothesis[], input: FusionInput): Promise<{
        hypotheses: MaiosHypothesis[];
        modelAgreement: number;
    }>;
};
export {};
//# sourceMappingURL=multi-model-fusion.service.d.ts.map