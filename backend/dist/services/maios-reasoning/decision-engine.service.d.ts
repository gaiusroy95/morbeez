import type { PosteriorEntry, ReasoningDecision, ReasoningEvidenceItem } from '../../domain/maios-reasoning/types.js';
export declare const maiosDecisionEngineService: {
    evaluate(params: {
        posterior: PosteriorEntry[];
        evidence: ReasoningEvidenceItem[];
        eqs: number;
        threshold?: number;
        escalationRecommended?: boolean;
        maiosRoute?: string;
    }): ReasoningDecision;
};
//# sourceMappingURL=decision-engine.service.d.ts.map