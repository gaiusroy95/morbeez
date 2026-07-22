declare function nextConceptCode(category: string): Promise<string>;
export declare const terminologyConceptSuggestService: {
    suggestForTask(params: {
        term: string;
        rawMessage: string;
        language?: string | null;
    }): Promise<{
        conceptId: string | null;
        conceptName: string | null;
        confidence: number;
    }>;
    attachSuggestionToTask(taskId: string): Promise<void>;
    nextConceptCode: typeof nextConceptCode;
};
export {};
//# sourceMappingURL=terminology-concept-suggest.service.d.ts.map