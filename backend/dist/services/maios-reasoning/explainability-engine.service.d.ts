import type { CropKnowledgePackage, PosteriorEntry, ReasoningEvidenceItem, ReasoningExplanation } from '../../domain/maios-reasoning/types.js';
export declare const maiosExplainabilityEngineService: {
    build(params: {
        pkg: CropKnowledgePackage;
        posterior: PosteriorEntry[];
        evidence: ReasoningEvidenceItem[];
        llmHypothesisLabels?: string[];
        missingPhotoSlots?: string[];
    }): ReasoningExplanation;
};
//# sourceMappingURL=explainability-engine.service.d.ts.map