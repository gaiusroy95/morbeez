type OrderRow = {
    id: string;
    farmer_id: string | null;
    total_amount: number | null;
    oms_status: string | null;
    delivered_at: string | null;
    payment_status?: string | null;
    attributed_partner_id: string | null;
    attributed_agronomist_email: string | null;
    incentive_eligibility: string | null;
    incentive_eligible_at: string | null;
    incentive_excluded_reason: string | null;
};
export declare const eligibleSaleEngine: {
    onOrderPaid(input: {
        orderId: string;
        farmerId?: string | null;
        grossInr?: number;
    }): Promise<void>;
    onDelivered(orderId: string): Promise<void>;
    onReturnOrRefund(orderId: string, reason: string): Promise<void>;
    refresh(orderId: string, facts?: {
        paid?: boolean;
    }): Promise<{
        status: string;
    } | null>;
    creditIncentives(order: OrderRow): Promise<void>;
    scanDue(limit?: number): Promise<{
        scanned: number;
    }>;
};
export {};
//# sourceMappingURL=eligible-sale.engine.d.ts.map