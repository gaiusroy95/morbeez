import type { GingerGateDecision, GingerSopRoute, GingerTriageLevel } from '../../domain/ginger-sop/types.js';
type GateInput = {
    identityComplete: boolean;
    evidenceCompleteness: number;
    evidenceTier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
    triageLevel: GingerTriageLevel;
    fusedConfidence: number;
    hasSoilForNutrientRec: boolean;
    needsNutrientAdvice: boolean;
    channel: 'whatsapp' | 'api' | 'web' | 'field_visit' | 'telecaller';
};
export declare const gingerSopGatesService: {
    evaluate(input: GateInput): {
        route: GingerSopRoute;
        gates: GingerGateDecision[];
    };
};
export {};
//# sourceMappingURL=ginger-sop-gates.service.d.ts.map