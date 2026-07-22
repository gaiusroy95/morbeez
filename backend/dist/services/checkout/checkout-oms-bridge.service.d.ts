export declare const checkoutOmsBridgeService: {
    /** Sync a storefront Razorpay checkout into commerce_orders and enter warehouse picking. */
    syncToWarehouse(input: {
        shopifyOrderId: string;
        razorpayPaymentId?: string;
    }): Promise<{
        commerceOrderId: null;
        omsStatus: null;
        orderName: null;
    } | {
        commerceOrderId: null;
        omsStatus: null;
        orderName: string;
    } | {
        commerceOrderId: any;
        omsStatus: string;
        orderName: string;
    }>;
    /** Backfill paid storefront checkouts that never reached commerce_orders / warehouse. */
    repairUnsyncedPaidCheckouts(limit?: number): Promise<{
        repaired: number;
        failed: number;
        scanned: number;
    }>;
};
//# sourceMappingURL=checkout-oms-bridge.service.d.ts.map