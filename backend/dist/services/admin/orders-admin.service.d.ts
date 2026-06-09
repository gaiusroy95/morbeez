export type OrderStatusTab = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export interface OrdersListQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: OrderStatusTab;
    payment?: 'cod' | 'paid' | '';
}
interface DetailLineItem {
    product: string;
    variant: string;
    mrp: number;
    price: number;
    qty: number;
    total: number;
    isFree: boolean;
}
export declare const ordersAdminService: {
    repairWarehouseOrderVisibility(): Promise<number>;
    list(query: OrdersListQuery): Promise<{
        orders: {
            id: string;
            source: "shopify" | "quote" | "razorpay_checkout";
            commerceOrderId: string | null;
            shopifyOrderId: string | null;
            orderName: string | null;
            displayOrderId: string;
            farmerName: string;
            email: string | null;
            phone: string | null;
            amount: number;
            currency: string;
            paymentLabel: string;
            status: "processing" | "pending" | "cancelled" | "delivered" | "shipped";
            financialStatus: string | null;
            fulfillmentStatus: string | null;
            omsStatus: string | null;
            createdAt: string;
            quoteExpiresAt: string | undefined;
            quoteHoursLeft: number | undefined;
            quotePaymentType: string | undefined;
            prepaidAmount: number | undefined;
            codAmount: number | undefined;
            isQuote: boolean;
            quoteStatus: string | undefined;
        }[];
        tabCounts: {
            all: number;
            pending: number;
            processing: number;
            shipped: number;
            delivered: number;
            cancelled: number;
        };
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    get(id: string): Promise<{
        orderDate: string;
        paymentStatus: string;
        statusLabel: string;
        customer: {
            name: string;
            phone: string | null;
            email: string | null;
            addressShort: string;
        };
        shipping: {
            name: string;
            addressLines: string[];
            courier: string;
            trackingId: string;
            trackingUrl: string | null;
        };
        lineItems: DetailLineItem[];
        totals: {
            subtotal: number;
            shipping: number;
            discount: number;
            total: number;
        };
        timeline: {
            key: string;
            label: string;
            at: string | null;
            done: boolean;
            pending: boolean;
        }[];
        notes: string;
        id: string;
        source: "shopify" | "quote" | "razorpay_checkout";
        commerceOrderId: string | null;
        shopifyOrderId: string | null;
        orderName: string | null;
        displayOrderId: string;
        farmerName: string;
        email: string | null;
        phone: string | null;
        amount: number;
        currency: string;
        paymentLabel: string;
        status: "processing" | "pending" | "cancelled" | "delivered" | "shipped";
        financialStatus: string | null;
        fulfillmentStatus: string | null;
        omsStatus: string | null;
        createdAt: string;
        quoteExpiresAt: string | undefined;
        quoteHoursLeft: number | undefined;
        quotePaymentType: string | undefined;
        prepaidAmount: number | undefined;
        codAmount: number | undefined;
        isQuote: boolean;
        quoteStatus: string | undefined;
    } | {
        orderDate: string;
        paymentStatus: string;
        statusLabel: string;
        customer: {
            name: string;
            phone: string | null;
            email: string | null;
            addressShort: string;
        };
        shipping: {
            name: string;
            addressLines: string[];
            courier: string;
            trackingId: string;
            trackingUrl: null;
        };
        lineItems: {
            product: string;
            variant: string;
            mrp: number;
            price: number;
            qty: number;
            total: number;
            isFree: boolean;
            hsnCode: string | undefined;
            gstPercent: number;
            sku: string | undefined;
        }[];
        totals: {
            subtotal: number;
            shipping: number;
            discount: number;
            total: number;
            cgst: number;
            sgst: number;
            igst: number;
            prepaidAmount: number;
            codAmount: number;
        };
        timeline: {
            key: string;
            label: string;
            at: string | null;
            done: boolean;
            pending: boolean;
        }[];
        notes: string;
        isQuote: boolean;
        quoteStatus: string;
        checkoutToken: string;
        id: string;
        source: "shopify" | "quote" | "razorpay_checkout";
        commerceOrderId: string | null;
        shopifyOrderId: string | null;
        orderName: string | null;
        displayOrderId: string;
        farmerName: string;
        email: string | null;
        phone: string | null;
        amount: number;
        currency: string;
        paymentLabel: string;
        status: "processing" | "pending" | "cancelled" | "delivered" | "shipped";
        financialStatus: string | null;
        fulfillmentStatus: string | null;
        omsStatus: string | null;
        createdAt: string;
        quoteExpiresAt: string | undefined;
        quoteHoursLeft: number | undefined;
        quotePaymentType: string | undefined;
        prepaidAmount: number | undefined;
        codAmount: number | undefined;
    }>;
    delete(id: string, source: "shopify" | "razorpay_checkout" | "quote" | undefined, actorEmail?: string): Promise<"commerce_quotes" | "checkout_sessions" | "commerce_orders">;
};
export {};
//# sourceMappingURL=orders-admin.service.d.ts.map