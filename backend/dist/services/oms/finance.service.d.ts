export declare const financeService: {
    getDashboard(): Promise<{
        dailySales: number;
        gstLiability: number;
        pendingCod: number;
        refunds: number;
        outstandingPayments: number;
        ordersToday: number;
        openNdrRto: number;
    }>;
    refreshDailySnapshot(date?: string): Promise<any>;
};
//# sourceMappingURL=finance.service.d.ts.map