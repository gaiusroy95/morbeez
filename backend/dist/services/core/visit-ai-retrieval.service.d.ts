import type { VisitPromptSimilarCase, VisitPromptTrainingExample } from './visit-ai-prompt-context.service.js';
export declare const visitAiRetrievalService: {
    findTrainingExamples(params: {
        farmerId: string;
        cropType: string;
        issueName: string;
        observation?: string;
        limit?: number;
    }): Promise<VisitPromptTrainingExample[]>;
    findVerifiedCases(params: {
        cropType: string;
        issueName: string;
        limit?: number;
    }): Promise<VisitPromptSimilarCase[]>;
};
//# sourceMappingURL=visit-ai-retrieval.service.d.ts.map