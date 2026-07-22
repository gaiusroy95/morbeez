import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { CropKnowledgePackage } from '../../domain/maios-reasoning/types.js';
export declare const maiosKnowledgeService: {
    load(cropType: string, _pack?: CropPackConfig): CropKnowledgePackage;
    listLikelihoodRatios(pkg: CropKnowledgePackage, evidenceKey: string): CropKnowledgePackage["likelihoodRatios"];
};
//# sourceMappingURL=knowledge.service.d.ts.map