declare const STAFF_ROLES: readonly ["super_admin", "admin", "operations", "agronomist", "telecaller", "manager", "viewer"];
export type StaffRole = (typeof STAFF_ROLES)[number];
export type StaffMember = {
    /** employee_profiles.id when HR profile exists; otherwise admin_users.id */
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
};
export type StaffWorkspace = {
    summary: {
        totalEmployees: number;
        activeCount: number;
        inactiveCount: number;
        avgPerformanceScore: number;
        avgTurnoverInr: number;
        pendingTasks: number;
    };
    secondary: {
        onlineNow: number;
        lateLogin: number;
        lowTurnover: number;
        totalLeads: number;
    };
    employees: StaffMember[];
};
export declare const staffAdminService: {
    getWorkspace(): Promise<StaffWorkspace>;
    getEmployeeDetail(id: string): Promise<{
        employee: StaffMember;
        overview: {
            pendingTasks: number;
            pendingFollowUps: number;
            newLeadsToday: number;
            interactionsThisMonth: number;
            onlineStatus: string;
            lastLoginAt: string | null;
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