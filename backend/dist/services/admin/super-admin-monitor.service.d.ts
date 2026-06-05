export type MonitorAlertAction = {
    kind: 'employee' | 'employees' | 'warehouse' | 'commerce';
    href: string;
    employeeProfileId?: string;
};
export declare const superAdminMonitorService: {
    refreshMonitor(opts?: {
        date?: string;
        monthYear?: string;
    }): Promise<{
        asOf: string;
        monthYear: string;
        dailySummary: {
            totalSales: number;
            grossProfit: number;
            avgRealizationPct: number;
            ordersCount: number;
            retailSales: number;
            bulkSales: number;
            cashCollected: number;
        };
        monthSummary: {
            totalSales: number;
            grossProfit: number;
            avgRealizationPct: number;
            ordersCount: number;
            retailSales: number;
            bulkSales: number;
            cashCollected: number;
        };
        employeeHeadwise: {
            employeeProfileId: string;
            fullName: string;
            employeeCode: string;
            salesInr: number;
            grossProfitInr: number;
            avgRealizationPct: number;
            incentiveInr: number;
            returnCostInr: number;
            adAllocationInr: number;
            netContributionInr: number;
            contributionLabel: "Good" | "Moderate" | "Weak" | "Strong";
            realizationStatus: string;
        }[];
        realizationMonitoring: {
            employeeProfileId: string;
            fullName: string;
            avgRealizationPct: number;
            status: string;
        }[];
        bulkOrderProfit: {
            customerKey: string;
            customerName: string;
            salesInr: number;
            grossProfitInr: number;
            marginPct: number;
            atRisk: boolean;
        }[];
        marginLeakage: {
            employeeProfileId: string;
            fullName: string;
            ordersNearFloor: number;
            avgDiscountPct: number;
            atRisk: boolean;
        }[];
        inventoryHealth: {
            deadStock: number;
            fastMovingStock: number;
            lowInventory: number;
            agingStock: number;
            stockValueUnits: number;
        };
        returnComplaints: {
            employeeProfileId: string;
            fullName: string;
            returnPct: number;
            complaintLevel: "High" | "Low" | "Medium";
        }[];
        employeePerformance: {
            employeeProfileId: string;
            fullName: string;
            kpiScore: number;
            grade: string;
            salesVolumeInr: number;
            incentiveEarnedInr: number;
        }[];
        cashFlow: {
            codPending: number;
            receivables: number;
            cashCollected: number;
            adSpend: number;
            adSpendSource: "estimated" | "logged";
            profitAfterExpenses: number;
        };
        alerts: {
            id: string;
            severity: "critical" | "warning";
            title: string;
            detail: string;
            action?: MonitorAlertAction;
        }[];
    }>;
    getMonitor(opts?: {
        date?: string;
        monthYear?: string;
    }): Promise<{
        asOf: string;
        monthYear: string;
        dailySummary: {
            totalSales: number;
            grossProfit: number;
            avgRealizationPct: number;
            ordersCount: number;
            retailSales: number;
            bulkSales: number;
            cashCollected: number;
        };
        monthSummary: {
            totalSales: number;
            grossProfit: number;
            avgRealizationPct: number;
            ordersCount: number;
            retailSales: number;
            bulkSales: number;
            cashCollected: number;
        };
        employeeHeadwise: {
            employeeProfileId: string;
            fullName: string;
            employeeCode: string;
            salesInr: number;
            grossProfitInr: number;
            avgRealizationPct: number;
            incentiveInr: number;
            returnCostInr: number;
            adAllocationInr: number;
            netContributionInr: number;
            contributionLabel: "Good" | "Moderate" | "Weak" | "Strong";
            realizationStatus: string;
        }[];
        realizationMonitoring: {
            employeeProfileId: string;
            fullName: string;
            avgRealizationPct: number;
            status: string;
        }[];
        bulkOrderProfit: {
            customerKey: string;
            customerName: string;
            salesInr: number;
            grossProfitInr: number;
            marginPct: number;
            atRisk: boolean;
        }[];
        marginLeakage: {
            employeeProfileId: string;
            fullName: string;
            ordersNearFloor: number;
            avgDiscountPct: number;
            atRisk: boolean;
        }[];
        inventoryHealth: {
            deadStock: number;
            fastMovingStock: number;
            lowInventory: number;
            agingStock: number;
            stockValueUnits: number;
        };
        returnComplaints: {
            employeeProfileId: string;
            fullName: string;
            returnPct: number;
            complaintLevel: "High" | "Low" | "Medium";
        }[];
        employeePerformance: {
            employeeProfileId: string;
            fullName: string;
            kpiScore: number;
            grade: string;
            salesVolumeInr: number;
            incentiveEarnedInr: number;
        }[];
        cashFlow: {
            codPending: number;
            receivables: number;
            cashCollected: number;
            adSpend: number;
            adSpendSource: "estimated" | "logged";
            profitAfterExpenses: number;
        };
        alerts: {
            id: string;
            severity: "critical" | "warning";
            title: string;
            detail: string;
            action?: MonitorAlertAction;
        }[];
    }>;
};
//# sourceMappingURL=super-admin-monitor.service.d.ts.map