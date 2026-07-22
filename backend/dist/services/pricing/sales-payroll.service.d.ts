export type MonthlyPayrollSales = {
    employeeProfileId: string;
    salesVolumeInr: number;
    grossProfitInr: number;
    incentiveEarnedInr: number;
    avgRealizationPct: number;
    salesAchievementPct: number;
    quarterlyBonusInr: number;
    kpiGrade: string | null;
    kpiScore: number | null;
    orderCount: number;
};
export declare const salesPayrollService: {
    getMonthlyTotals(employeeProfileId: string, year: number, month: number): Promise<MonthlyPayrollSales>;
};
//# sourceMappingURL=sales-payroll.service.d.ts.map