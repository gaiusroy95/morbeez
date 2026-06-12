export declare const marketingSpendService: {
    getMonthTotal(monthYear: string): Promise<number>;
    listByMonth(monthYear: string): Promise<any[]>;
    addEntry(input: {
        monthYear: string;
        channel: string;
        amountInr: number;
        notes?: string;
        recordedBy?: string;
        campaignName?: string;
        marketingOwnerId?: string | null;
        spendDate?: string;
    }): Promise<any>;
    listByDateRange(from: string, to: string): Promise<any[]>;
    listIncentiveRules(): Promise<any[]>;
    updateIncentiveRule(id: string, patch: {
        flatConnectedInr?: number;
        flatBookedInr?: number;
        flatPaidInr?: number;
        monthlyCapInr?: number | null;
        isActive?: boolean;
    }): Promise<any>;
};
//# sourceMappingURL=marketing-spend.service.d.ts.map