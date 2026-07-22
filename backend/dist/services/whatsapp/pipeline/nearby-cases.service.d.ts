export type NearbyCaseSummary = {
    pincode: string | null;
    district: string | null;
    samePincodeFarmers: number;
    recentIssues: Array<{
        issueLabel: string;
        count: number;
    }>;
    verifiedReuseHits: number;
};
export declare const nearbyCasesService: {
    summarize(farmerId: string, cropType: string): Promise<NearbyCaseSummary>;
    formatForPrompt(summary: NearbyCaseSummary): string;
};
//# sourceMappingURL=nearby-cases.service.d.ts.map