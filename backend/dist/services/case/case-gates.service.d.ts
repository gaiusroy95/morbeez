import type { MaiosChannel, MaiosGateDecision, MaiosRoute, MaiosTriageLevel, EvidenceTier } from '../../domain/case/types.js';
type GateInput = {
    identityComplete: boolean;
    evidenceCompleteness: number;
    eqs: number;
    evidenceTier: EvidenceTier;
    triageLevel: MaiosTriageLevel;
    fusedConfidence: number;
    hasSoilForNutrientRec: boolean;
    needsNutrientAdvice: boolean;
    channel: MaiosChannel;
    recoveryScheduled?: boolean;
};
export declare const caseGatesService: {
    evaluate(input: GateInput): {
        route: MaiosRoute;
        gates: MaiosGateDecision[];
    };
};
export {};
//# sourceMappingURL=case-gates.service.d.ts.map