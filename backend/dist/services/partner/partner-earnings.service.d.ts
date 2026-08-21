export declare const partnerEarningsService: {
    getSummary(partnerId: string, filter?: {
        from?: string;
        to?: string;
        month?: string;
    }): Promise<{
        leadBonus: number;
        cashRewards: number;
        reliabilityHoldPct: number;
        farmersIntroduced: number;
        farmersVerified: number;
        eligibleIntroductions: number;
        cashRewardEarned: number;
        productRewardAvailable: number;
        productRewardUsed: number;
        productRewardBalance: number;
        heldPayout: number;
        duePayout: number;
        months: import("../remuneration/earning-drilldown.service.js").MonthBucket[];
        productCommission: number;
        successBonus: number;
        serviceRevenue: number;
        pendingPayout: number;
        approvedPayout: number;
        paidPayout: number;
        month: string | null;
        fromDate: string | null;
        toDate: string | null;
    }>;
    listLedger(partnerId: string, filter?: {
        month?: string;
        from?: string;
        to?: string;
    }): Promise<{
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