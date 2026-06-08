export declare const quoteOmsBridgeService: {
    /** Sync a Shopify order into commerce_orders + lines and auto-confirm for warehouse picking. */
    syncShopifyOrderToWarehouse(input: {
        shopifyOrderId: string;
        farmerId?: string | null;
        leadId?: string | null;
        quoteId?: string;
        quoteNumber?: string;
        paymentMethod?: string;
    }): Promise<{
        commerceOrderId: null;
        omsStatus: null;
        orderName?: undefined;
    } | {
        commerceOrderId: any;
        omsStatus: any;
        orderName: string;
    }>;
    listQuoteQueue(limit?: number): Promise<{
        id: any;
        quoteNumber: any;
        status: any;
        customerName: any;
        total: number;
        prepaidAmount: number;
        codAmount: number;
        commerceOrderId: string | null;
        shopifyOrderId: any;
        pickStatus: string | null;
        queueStatus: "awaiting_payment" | "awaiting_warehouse" | "in_warehouse";
        updatedAt: any;
    }[]>;
};
//# sourceMappingURL=quote-oms-bridge.service.d.ts.map