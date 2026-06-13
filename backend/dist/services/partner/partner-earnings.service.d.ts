export declare const partnerEarningsService: {
    getSummary(partnerId: string, periodMonth?: string): Promise<{
        month: string;
        serviceRevenue: number;
        productCommission: number;
        leadBonus: number;
        successBonus: number;
        pendingPayout: number;
        approvedPayout: number;
        paidPayout: number;
        reliabilityHoldPct: number;
    }>;
    listLedger(partnerId: string, periodMonth?: string): Promise<{
        id: string;
        category: string;
        grossInr: number;
        commissionInr: number;
        bonusInr: number;
        status: string;
        periodMonth: string;
        createdAt: string;
    }[]>;
};
//# sourceMappingURL=partner-earnings.service.d.ts.map