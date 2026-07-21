import type { CropKnowledgePackage, EvsiCandidate, PosteriorEntry, ReasoningEvidenceItem } from '../../domain/maios-reasoning/types.js';
export declare const maiosEvsiEngineService: {
    rankQuestions(params: {
        pkg: CropKnowledgePackage;
        posterior: PosteriorEntry[];
        evidence: ReasoningEvidenceItem[];
        answeredQuestionIds: Set<string>;
    }): EvsiCandidate | null;
    rankMissingPhoto(params: {
        missingSlots: string[];
        posterior: PosteriorEntry[];
    }): EvsiCandidate | null;
};
//# sourceMappingURL=evsi-engine.service.d.ts.map