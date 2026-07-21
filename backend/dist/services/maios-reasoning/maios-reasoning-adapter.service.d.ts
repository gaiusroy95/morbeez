import type { MaiosHypothesis, MaiosPhotoEvidence } from '../../domain/case/types.js';
import type { MaiosRoute } from '../../domain/case/types.js';
import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { VisitAiContextPack } from '../core/visit-ai-context.service.js';
import { type MaiosReasoningPipelineInput } from './maios-reasoning-pipeline.service.js';
export type VisitReasoningAdapterInput = {
    context: VisitAiContextPack;
    issueName: string;
    observation?: string;
    hypotheses: Array<{
        label: string;
        confidence: number;
        rationale?: string;
        imagePrediction?: string;
        imageConfidence?: number;
        selected?: boolean;
    }>;
    imageSignal?: {
        label: string;
        confidence: number;
        observations?: Array<{
            feature: string;
            value: string;
            confidence: number;
        }>;
    } | null;
    analyzePhotoCount?: number;
    farmerAnswers?: Array<{
        questionId?: string;
        questionText: string;
        answer: string;
    }>;
    answeredQuestionIds?: string[];
};
export type VisitHypothesisRow = VisitReasoningAdapterInput['hypotheses'][number];
export type WhatsAppReasoningAdapterInput = {
    cropType: string;
    symptomsText?: string;
    contextPack?: MaiosReasoningPipelineInput['contextPack'];
    hypotheses: MaiosHypothesis[];
    photos: MaiosPhotoEvidence[];
    eqs: number;
    maiosRoute?: MaiosRoute;
    escalationRecommended?: boolean;
    visionLabel?: string | null;
    visionConfidence?: number;
    farmerAnswers?: Array<{
        questionId?: string;
        questionText: string;
        answer: string;
    }>;
    answeredQuestionIds?: string[];
    harvestWithinDays?: number | null;
    dap?: number | null;
    visionObservations?: Array<{
        feature: string;
        value: string;
        confidence: number;
    }>;
};
/** When shadow mode is off, Bayesian posterior replaces LLM hypothesis ranking on visit path. */
export declare function applyBayesianToVisitHypotheses<T extends VisitHypothesisRow>(hypotheses: T[], reasoning: MaiosReasoningSnapshot | null): T[];
/** Adapters that run v17 reasoning from visit wizard and WhatsApp without replacing existing LLM paths. */
export declare const maiosReasoningAdapterService: {
    fromVisit(input: VisitReasoningAdapterInput): Promise<MaiosReasoningSnapshot | null>;
    fromWhatsApp(input: WhatsAppReasoningAdapterInput): Promise<MaiosReasoningSnapshot | null>;
};
//# sourceMappingURL=maios-reasoning-adapter.service.d.ts.map