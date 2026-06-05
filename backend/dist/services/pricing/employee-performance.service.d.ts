export type EmployeePerformanceRow = {
    employeeProfileId: string;
    adminUserId: string | null;
    fullName: string;
    employeeCode: string;
    salesVolumeInr: number;
    orderCount: number;
    avgRealizationPct: number;
    grossProfitInr: number;
    netProfitInr: number;
    incentiveEarnedInr: number;
    repeatCustomers: number;
    returnCount: number;
    status: 'excellent' | 'good' | 'warning' | 'critical' | 'restricted';
    actionStage: number;
};
export declare const employeePerformanceService: {
    recomputeDailySnapshot(employeeProfileId: string, date: string): Promise<{
        employee_profile_id: string;
        admin_user_id: any;
        snapshot_date: string;
        period: string;
        sales_volume_inr: number;
        order_count: number;
        avg_realization_pct: number;
        gross_profit_inr: number;
        net_profit_inr: number;
        incentive_earned_inr: number;
        repeat_customers: number;
        return_count: number;
        performance_status: "warning" | "good" | "critical" | "excellent" | "restricted";
        action_stage: number;
        metadata: {};
    }>;
    getDashboard(opts?: {
        period?: "daily" | "weekly";
        date?: string;
    }): Promise<{
        date: string;
        period: "daily" | "weekly";
        employees: EmployeePerformanceRow[];
    }>;
    getMyPerformance(adminUserId: string): Promise<{
        fullName: any;
        employeeCode: any;
        today: {
            salesVolumeInr: number;
            avgRealizationPct: number;
            grossProfitInr: number;
            netProfitInr: number;
            incentiveEarnedInr: number;
            status: any;
            actionStage: number;
        } | null;
        thresholds: {
            excellent: number;
            good: number;
            warning: number;
        };
    } | null>;
};
//# sourceMappingURL=employee-performance.service.d.ts.map