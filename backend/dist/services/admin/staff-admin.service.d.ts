declare const STAFF_ROLES: readonly ["super_admin", "admin", "operations", "agronomist", "telecaller", "manager", "viewer"];
export type StaffRole = (typeof STAFF_ROLES)[number];
export type StaffMember = {
    id: string;
    adminUserId: string | null;
    hasProfile: boolean;
    email: string;
    fullName: string;
    role: string;
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    employeeCode: string;
    agronomistTier: 'new' | 'experienced' | null;
    totalLeads: number;
    pendingTasks: number;
    pendingFollowUpsToday: number;
    turnoverInr: number;
    performanceScore: number;
    performanceLabel: string;
    performanceSource: 'engine' | 'estimated';
    attributedFarmerCount: number;
    leaderboardEligible: boolean;
    statusOnline: boolean;
    lateLoginDays: number | null;
    isLateLogin: boolean;
    interactionsToday: number;
    interactionsThisMonth: number;
    estimatedIncentiveInr: number;
    roiPct: number;
};
export type StaffWorkspace = {
    summary: {
        totalEmployees: number;
        activeCount: number;
        inactiveCount: number;
        avgPerformanceScore: number;
        avgTurnoverInr: number;
        pendingTasks: number;
        interactionsToday: number;
        avgRoiPct: number;
    };
    secondary: {
        onlineNow: number;
        lateLogin: number;
        lowTurnover: number;
        totalLeads: number;
        interactionsToday: number;
    };
    employees: StaffMember[];
};
export declare const staffAdminService: {
    clearWorkspaceCache(): void;
    getWorkspace(opts?: {
        skipCache?: boolean;
    }): Promise<StaffWorkspace>;
    getEmployeeDetail(id: string): Promise<{
        employee: StaffMember;
        overview: {
            pendingTasks: number;
            pendingFollowUps: number;
            newLeadsToday: number;
            interactionsToday: number;
            interactionsThisMonth: number;
            onlineStatus: string;
            lastLoginAt: string | null;
            lateLoginDays: number | null;
            isLateLogin: boolean;
            estimatedIncentiveInr: number;
            roiPct: number;
            avgPerformanceScore: number;
            attributedFarmerCount: number;
            leaderboardEligible: boolean;
            performanceSource: "estimated" | "engine";
        };
        turnoverTrend: {
            labels: string[];
            values: number[];
        };
        performanceBreakdown: {
            label: string;
            pct: number;
        }[];
        performanceFactors: unknown[];
        recentLeads: {
            id: any;
            name: string;
            crop: string;
            when: any;
        }[];
        recentTasks: {
            id: any;
            title: any;
            status: any;
            dueAt: any;
        }[];
    } | null>;
};
export {};
//# sourceMappingURL=staff-admin.service.d.ts.map