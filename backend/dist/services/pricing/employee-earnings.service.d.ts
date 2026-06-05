export type MonthlyEarningsRow = {
    monthYear: string;
    salesVolumeInr: number;
    salesTargetInr: number;
    salesAchievementPct: number;
    grossProfitInr: number;
    incentiveEarnedInr: number;
    fixedSalaryInr: number;
    quarterlyBonusInr: number;
    totalEarningsInr: number;
    totalScore: number;
    grade: string;
    avgRealizationPct: number;
    fromPayroll: boolean;
};
export type SalesLedgerRow = {
    id: string;
    recordedAt: string;
    productTitle: string | null;
    sku: string | null;
    qty: number;
    finalUnitPrice: number;
    incentiveAmount: number;
    grossProfit: number;
    retailOrBulk: string | null;
    status: string;
    quoteNumber: string | null;
};
export declare const employeeEarningsService: {
    getMyEarnings(adminUserId: string): Promise<{
        profile: {
            fullName: string;
            employeeCode: string;
            role: string;
            status: string;
            state: string | null;
            district: string | null;
        };
        compensation: {
            fixedSalaryInr: number;
            monthlySalesTargetInr: number;
            incentiveEnabled: boolean;
            travelAllowanceInr: number;
        };
        currentMonth: MonthlyEarningsRow;
        monthlyHistory: MonthlyEarningsRow[];
        recentSales: SalesLedgerRow[];
        config: {
            monthlySalesTargetInr: number;
            bulkOrderThresholdInr: number;
        };
    } | null>;
};
//# sourceMappingURL=employee-earnings.service.d.ts.map