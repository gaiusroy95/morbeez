export declare const partnerPayoutService: {
    generateMonth(month?: string): Promise<{
        period: string;
        batches: {
            id: string;
            partnerId: string;
            totalInr: number;
            lineCount: number;
        }[];
    }>;
    list(month?: string): Promise<{
        partnerName: any;
        partnerCode: any;
        id: any;
        partner_id: any;
        period_month: any;
        total_inr: any;
        status: any;
        approved_by: any;
        paid_at: any;
        created_at: any;
    }[]>;
    approve(batchId: string, actorEmail: string): Promise<any>;
    markPaid(batchId: string): Promise<any>;
    reverseOrder(orderId: string, reason: string): Promise<{
        reversed: number;
    }>;
    adjustOrder(orderId: string, reason: string): Promise<{
        adjusted: number;
    }>;
};
//# sourceMappingURL=partner-payout.service.d.ts.map