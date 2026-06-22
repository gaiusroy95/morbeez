export type CopilotAskInput = {
    question: string;
    aiCaseId?: string;
    farmerId?: string;
    blockId?: string;
    cropType?: string;
    issueName?: string;
};
export declare const agronomistCopilotService: {
    ask(input: CopilotAskInput): Promise<{
        answer: string;
        citations: string[];
    }>;
    whyDiagnosis(aiCaseId: string): Promise<{
        answer: string;
        citations: string[];
    }>;
};
//# sourceMappingURL=agronomist-copilot.service.d.ts.map