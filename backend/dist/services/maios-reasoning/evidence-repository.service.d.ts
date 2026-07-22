import type { MaiosPhotoEvidence } from '../../domain/case/types.js';
import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { ReasoningEvidenceItem } from '../../domain/maios-reasoning/types.js';
export type EvidenceRepositoryInput = {
    contextItems: ReasoningEvidenceItem[];
    visionLabel?: string | null;
    visionConfidence?: number;
    visionFeatures?: Array<{
        feature: string;
        value: string;
        confidence: number;
    }>;
    farmerAnswers?: Array<{
        questionId?: string;
        questionText: string;
        answer: string;
    }>;
    photos: MaiosPhotoEvidence[];
    pack: CropPackConfig;
    labSummary?: string | null;
    cropType?: string;
};
export declare const maiosEvidenceRepositoryService: {
    merge(input: EvidenceRepositoryInput): ReasoningEvidenceItem[];
    missingPhotoSlots(input: EvidenceRepositoryInput): string[];
};
//# sourceMappingURL=evidence-repository.service.d.ts.map