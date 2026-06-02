export type OpportunityAlertType = 'farmer_at_risk' | 'farmer_churned' | 'high_opportunity_idle' | 'employee_at_risk_cohort';
export type OpportunityAlertRow = {
    id: string;
    alertType: OpportunityAlertType;
    severity: 'info' | 'warning' | 'critical';
    farmerId: string | null;
    employeeProfileId: string | null;
    leadId: string | null;
    title: string;
    body: string | null;
    metadata: Record<string, unknown>;
    status: string;
    createdAt: string;
    acknowledgedAt: string | null;
};
export declare const opportunityIntelligenceAlertsService: {
    list(opts?: {
        status?: string;
        alertType?: OpportunityAlertType;
        limit?: number;
    }): Promise<OpportunityAlertRow[]>;
    acknowledge(alertId: string, adminUserId: string): Promise<void>;
    dismiss(alertId: string, adminUserId: string): Promise<void>;
    /**
     * Scan retention + opportunity tables and open daily alerts (idempotent per IST day).
     */
    generateDailyAlerts(): Promise<{
        created: number;
        skipped: number;
        farmerAtRisk: number;
        farmerChurned: number;
        highOpportunityIdle: number;
        employeeCohort: number;
    }>;
    /** Create CRM follow-up tasks for open farmer retention alerts. */
    enqueueRetentionTasks(limit?: number): Promise<{
        tasksCreated: number;
        alertsResolved: number;
    }>;
};
//# sourceMappingURL=opportunity-intelligence-alerts.service.d.ts.map