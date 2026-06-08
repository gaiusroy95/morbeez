type QuoteLine = {
    variantId?: number;
    sku?: string;
    title: string;
    qty: number;
    unitPrice: number;
    gstPercent?: number;
    hsnCode?: string;
    cgst?: number;
    sgst?: number;
    igst?: number;
};
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
    /**
     * Fallback when Shopify order API fails after Razorpay payment is already captured.
     * Creates commerce_orders + lines locally and enters the warehouse pipeline.
     */
    createLocalOrderFromQuote(input: {
        quoteId: string;
        quoteNumber: string;
        farmerId?: string | null;
        leadId?: string | null;
        customerName: string;
        customerPhone?: string | null;
        customerEmail?: string | null;
        customerState: string;
        shippingAddress: Record<string, string>;
        lineItems: QuoteLine[];
        total: number;
        prepaidAmount: number;
        codAmount: number;
        razorpayPaymentId: string;
        razorpayOrderId: string;
        /** paid = Razorpay captured; cod = COD confirmation without online payment */
        fulfillmentMode?: "paid" | "cod";
    }): Promise<{
        commerceOrderId: any;
        shopifyOrderId: string;
        orderName: string;
        order: any;
        alreadyExists: boolean;
        pickList?: undefined;
    } | {
        commerceOrderId: any;
        shopifyOrderId: string;
        orderName: string;
        pickList: any;
        alreadyExists: boolean;
        order?: undefined;
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
export {};
//# sourceMappingURL=quote-oms-bridge.service.d.ts.map