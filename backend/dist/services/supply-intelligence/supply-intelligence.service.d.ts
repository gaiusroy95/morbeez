export declare const supplyIntelligenceService: {
    enabled(): boolean;
    suggestFulfillment(_params: {
        technicalNames: string[];
        farmerId: string;
    }): Promise<{
        stockStatus: "in_stock" | "low" | "out_of_stock";
        substitutes: string[];
        leadTimeDays: number | null;
    }>;
};
//# sourceMappingURL=supply-intelligence.service.d.ts.map