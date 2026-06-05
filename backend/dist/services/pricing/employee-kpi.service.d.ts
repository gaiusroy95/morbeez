export declare const employeeKpiService: {
    recomputeMonthlyKpi(employeeProfileId: string, monthYear: string): Promise<{
        employee_profile_id: string;
        admin_user_id: any;
        month_year: string;
        sales_volume_inr: number;
        sales_target_inr: number;
        sales_achievement_pct: number;
        avg_realization_pct: number;
        gross_profit_inr: number;
        net_profit_inr: number;
        incentive_earned_inr: number;
        repeat_customers: number;
        collection_efficiency_pct: number;
        return_complaint_count: number;
        score_sales: number;
        score_realization: number;
        score_profit: number;
        score_repeat: number;
        score_collection: number;
        score_returns: number;
        total_score: number;
        grade: "A" | "B" | "C" | "A+" | "Risk";
        computed_at: string;
    }>;
    recomputeQuarterlyBonus(employeeProfileId: string, quarterKey: string): Promise<{
        employee_profile_id: string;
        quarter_key: string;
        avg_monthly_score: number;
        avg_realization_pct: number;
        grade: "A" | "B" | "C" | "A+" | "Risk";
        bonus_amount: number;
        bonus_eligible: boolean;
        status: string;
        notes: string | null;
        computed_at: string;
    } | null>;
    getDashboard(monthYear?: string): Promise<{
        monthYear: string;
        employees: {
            employeeProfileId: string;
            fullName: string;
            employeeCode: string;
            salesVolumeInr: number;
            avgRealizationPct: number;
            grossProfitInr: number;
            netProfitInr: number;
            incentiveEarnedInr: number;
            totalScore: number;
            grade: string;
            salesAchievementPct: number;
            profitLabel: string;
        }[];
    }>;
    recomputeAllForMonth(monthYear?: string): Promise<void>;
};
//# sourceMappingURL=employee-kpi.service.d.ts.map