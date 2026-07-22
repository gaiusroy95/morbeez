export type Farmer360Profile = {
    farmerId: string;
    name: string;
    phone: string | null;
    district: string | null;
    village: string | null;
    healthBand: string | null;
    retentionBand: string | null;
    complianceScore: number;
    riskScore: number;
    opportunityScore: number | null;
    purchaseSummary: {
        orderCount: number;
        totalValue: number | null;
    };
    timeline: Array<{
        at: string;
        kind: string;
        summary: string;
    }>;
};
export declare const farmerIntelligenceService: {
    getFarmer360(farmerId: string): Promise<Farmer360Profile>;
};
//# sourceMappingURL=farmer-intelligence.service.d.ts.map