import type { VisitAiContextPack } from './visit-ai-context.service.js';
import type { VisitImageSignal } from './visit-ai-image.service.js';
export type VisitPromptSimilarCase = {
    issueLabel: string;
    outcome: string | null;
    expertDiagnosis?: string | null;
    reviewAction?: string | null;
};
export type VisitPromptTrainingExample = {
    symptoms: string;
    aiDiagnosis: string;
    expertDiagnosis: string;
    outcome: string | null;
    reviewAction: string | null;
};
/** Context-only evidence signals — never mutate diagnosis confidence post-hoc. */
export type VisitPromptEvidenceSignal = {
    signal: string;
    reason: string;
};
/** @deprecated Use VisitPromptEvidenceSignal — kept for migration compatibility */
export type VisitPromptFusionHint = VisitPromptEvidenceSignal & {
    boost?: number;
};
declare function formatSoilBlock(soilTestSummary: VisitAiContextPack['soilTestSummary']): string;
declare function formatWeatherBlock(weather: VisitAiContextPack['weatherSnapshot']): string;
export declare function computeEvidenceSignals(context: VisitAiContextPack, issueCategory: string, imageSignal: VisitImageSignal | null | undefined): VisitPromptEvidenceSignal[];
/** @deprecated Context-only — do not use boost values for confidence mutation */
export declare function computeFusionHints(context: VisitAiContextPack, issueCategory: string, imageSignal: VisitImageSignal | null | undefined): VisitPromptEvidenceSignal[];
export declare const visitAiPromptContextService: {
    buildPromptBlock(params: {
        context: VisitAiContextPack;
        issueCategory: string;
        issueName: string;
        observation?: string;
        imageSignal?: VisitImageSignal | null;
        similarCases?: VisitPromptSimilarCase[];
        trainingExamples?: VisitPromptTrainingExample[];
        qaAnswers?: Array<{
            question: string;
            answer: string;
        }>;
    }): Promise<string>;
    formatSoilBlock: typeof formatSoilBlock;
    formatWeatherBlock: typeof formatWeatherBlock;
    computeEvidenceSignals: typeof computeEvidenceSignals;
    computeFusionHints: typeof computeFusionHints;
};
export {};
//# sourceMappingURL=visit-ai-prompt-context.service.d.ts.map