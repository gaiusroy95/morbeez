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
export type VisitPromptFusionHint = {
    label: string;
    boost: number;
    reason: string;
};
declare function formatSoilBlock(soilTestSummary: VisitAiContextPack['soilTestSummary']): string;
declare function formatWeatherBlock(weather: VisitAiContextPack['weatherSnapshot']): string;
export declare function computeFusionHints(context: VisitAiContextPack, issueCategory: string, imageSignal: VisitImageSignal | null | undefined): VisitPromptFusionHint[];
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
    computeFusionHints: typeof computeFusionHints;
};
export {};
//# sourceMappingURL=visit-ai-prompt-context.service.d.ts.map