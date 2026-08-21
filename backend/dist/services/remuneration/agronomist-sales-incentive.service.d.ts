export declare const agronomistSalesIncentiveService: {
    accrueForOrder(input: {
        agronomistEmail: string;
        farmerId: string;
        orderId: string;
        grossInr: number;
        periodMonth?: string;
    }): Promise<{
        id: string;
        amountInr: number;
    } | {
        id: any;
        amount_inr: any;
        status: any;
        employee_profile_id: any;
        period_month: any;
    } | null>;
    adjustOrder(orderId: string, reason: string): Promise<{
        adjusted: number;
    }>;
};
//# sourceMappingURL=agronomist-sales-incentive.service.d.ts.map