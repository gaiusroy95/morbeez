export type AdaptiveProtocolSuggestion = {
    failureType: string;
    issueLabel: string;
    cropType: string;
    district: string;
    alternateTemplates: Array<{
        templateKey: string;
        label: string;
        score: number;
    }>;
};
export declare const adaptiveProtocolService: {
    suggestOnWorseOutcome(input: {
        issueLabel: string;
        cropType: string;
        district: string;
        outcomeStatus: "worse";
        agronomistCorrected?: boolean;
        applicationLogged?: boolean;
        fusedConfidence?: number;
    }): Promise<AdaptiveProtocolSuggestion | null>;
    listRecentSuggestions(limit?: number): Promise<AdaptiveProtocolSuggestion[]>;
};
//# sourceMappingURL=adaptive-protocol.service.d.ts.map