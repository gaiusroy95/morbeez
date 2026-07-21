import type { MaiosHypothesis, MaiosPhotoEvidence } from '../../domain/case/types.js';
import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
export type MaiosReasoningPipelineInput = {
    cropType: string;
    pack: CropPackConfig;
    symptomsText?: string;
    contextPack?: {
        weatherRiskScore?: number;
        heavyRainLikely?: boolean;
        highHeatLikely?: boolean;
        highHumidityLikely?: boolean;
        soilPh?: number;
        soilEc?: number;
        dap?: number | null;
        daysSinceLastFertilizer?: number | null;
        cropType?: string;
    };
    regionalPriors?: Array<{
        issueLabel: string;
        caseCount: number;
    }>;
    photos: MaiosPhotoEvidence[];
    hypotheses: MaiosHypothesis[];
    eqs: number;
    maiosRoute?: string;
    escalationRecommended?: boolean;
    visionLabel?: string | null;
    visionConfidence?: number;
    farmerAnswers?: Array<{
        questionId?: string;
        questionText: string;
        answer: string;
    }>;
    answeredQuestionIds?: string[];
    visionObservations?: Array<{
        feature: string;
        value: string;
        confidence: number;
    }>;
    dap?: number | null;
    harvestWithinDays?: number | null;
};
/** Composes MAIOS v12 case data through v17 reasoning domains without replacing LLM/MAIOS fusion. */
export declare const maiosReasoningPipelineService: {
    isEnabled(): boolean;
    run(input: MaiosReasoningPipelineInput): Promise<MaiosReasoningSnapshot | null>;
    /** Blend Bayesian posterior into existing MAIOS hypotheses (enrichment, not replacement). */
    enrichHypotheses(hypotheses: MaiosHypothesis[], snapshot: MaiosReasoningSnapshot): MaiosHypothesis[];
};
//# sourceMappingURL=maios-reasoning-pipeline.service.d.ts.map