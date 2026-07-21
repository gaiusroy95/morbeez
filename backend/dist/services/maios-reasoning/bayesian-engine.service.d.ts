import type { CropKnowledgePackage, PosteriorEntry, ReasoningEvidenceItem } from '../../domain/maios-reasoning/types.js';
export declare const maiosBayesianEngineService: {
    buildPrior(pkg: CropKnowledgePackage, regionalBoost?: Array<{
        issueLabel: string;
        caseCount: number;
    }>): PosteriorEntry[];
    update(pkg: CropKnowledgePackage, prior: PosteriorEntry[], evidence: ReasoningEvidenceItem[]): PosteriorEntry[];
    topConfidence(posterior: PosteriorEntry[]): number;
};
//# sourceMappingURL=bayesian-engine.service.d.ts.map