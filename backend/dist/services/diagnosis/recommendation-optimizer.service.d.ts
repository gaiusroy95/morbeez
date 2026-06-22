export type RecommendationOption = {
    id: string;
    label: string;
    costInr: number;
    expectedRecoveryPct: number;
    roiNote: string;
    proceed: boolean;
};
export declare const recommendationOptimizerService: {
    buildOptions(input: {
        issueLabel: string;
        cropType: string;
        district?: string;
        farmerSegment?: "premium" | "roi_focused" | "low_budget";
        baseProtocols?: Array<{
            label: string;
            costInr: number;
            materials?: string[];
        }>;
    }): Promise<RecommendationOption[]>;
};
//# sourceMappingURL=recommendation-optimizer.service.d.ts.map