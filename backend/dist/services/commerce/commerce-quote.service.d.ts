export type QuoteLineItem = {
    variantId?: number;
    productId?: number;
    sku?: string;
    title: string;
    variantTitle?: string;
    hsnCode?: string;
    qty: number;
    unitPrice: number;
    gstPercent: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    amountInclGst: number;
};
export type CommerceQuote = {
    id: string;
    quoteNumber: string;
    status: string;
    leadId: string | null;
    farmerId: string | null;
    customerName: string;
    customerPhone: string | null;
    customerEmail: string | null;
    customerState: string;
    customerGstin: string | null;
    shippingAddress: Record<string, string>;
    lineItems: QuoteLineItem[];
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    paymentType: string;
    prepaidAmount: number;
    codAmount: number;
    checkoutToken: string;
    expiresAt: string;
    commerceOrderId: string | null;
    invoiceId: string | null;
    razorpayOrderId: string | null;
    shopifyOrderId: string | null;
    shopifyOrderName: string | null;
    preparedByName: string | null;
    sentAt: string | null;
    whatsappSentAt: string | null;
    emailSentAt: string | null;
    acceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
    hoursLeft?: number;
};
type QuoteLineInput = {
    variantId?: number;
    productId?: number;
    sku?: string;
    title: string;
    variantTitle?: string;
    hsnCode?: string;
    qty: number;
    unitPrice: number;
    gstPercent?: number;
};
export declare const commerceQuoteService: {
    purgeExpired(): Promise<number>;
    list(): Promise<CommerceQuote[]>;
    get(id: string): Promise<CommerceQuote>;
    getByToken(token: string): Promise<CommerceQuote>;
    listByLead(leadId: string): Promise<CommerceQuote[]>;
    getEstimateDetail(id: string, leadId?: string): Promise<{
        quote: CommerceQuote;
        company: import("../admin/company-settings.service.js").CompanySettings;
        document: {
            title: string;
            quotationId: string;
            dateLabel: string;
            validUntilLabel: string;
            billTo: string[];
            shipTo: string[];
            paymentTypeLabel: string;
            preparedByName: string | null;
            subtotal: number;
            totalInclGst: number;
        };
    }>;
    createFromLead(leadId: string, input: {
        lines: Array<{
            variantId?: number;
            productId?: number;
            sku?: string;
            title: string;
            variantTitle?: string;
            hsnCode?: string;
            qty: number;
            unitPrice: number;
            gstPercent?: number;
        }>;
        prepaidAmount?: number;
        paymentType?: "full" | "partial" | "advance";
        preparedByName?: string;
        orderType?: "standard" | "bulk" | "clearance" | "strategic" | "liquidation";
    }, adminId?: string): Promise<CommerceQuote>;
    updateFromLead(quoteId: string, leadId: string, input: {
        lines: QuoteLineInput[];
        prepaidAmount?: number;
        paymentType?: "full" | "partial" | "advance";
        preparedByName?: string;
        orderType?: "standard" | "bulk" | "clearance" | "strategic" | "liquidation";
    }, adminId?: string): Promise<CommerceQuote>;
    getShareLinks(quoteId: string, leadId?: string): Promise<{
        text: string;
        checkoutUrl: string;
        viewUrl: string;
        whatsappUrl: string | null;
        mailtoUrl: string | null;
    }>;
    sendQuote(quoteId: string, leadId: string, channels: Array<"whatsapp" | "email">, agentEmail?: string): Promise<{
        text: string;
        whatsappUrl: string | null;
        mailtoUrl: string | null;
        whatsappSent: boolean;
        emailSent: boolean;
    }>;
    create(input: {
        customerName: string;
        customerPhone?: string;
        customerEmail?: string;
        customerState: string;
        customerGstin?: string;
        shippingAddress?: Record<string, string | undefined>;
        paymentType?: "full" | "partial" | "advance";
        prepaidAmount?: number;
        leadId?: string;
        farmerId?: string;
        preparedByName?: string;
        orderType?: "standard" | "bulk" | "clearance" | "strategic" | "liquidation";
        lines: Array<{
            variantId?: number;
            productId?: number;
            sku?: string;
            title: string;
            variantTitle?: string;
            hsnCode?: string;
            qty: number;
            unitPrice: number;
            gstPercent?: number;
        }>;
    }, adminId?: string): Promise<CommerceQuote>;
    startCheckout(id: string, input: {
        paymentType: "full" | "partial";
        prepaidAmount?: number;
    }): Promise<CommerceQuote>;
    createPayment(id: string): Promise<{
        quoteId: string;
        razorpayOrderId: string;
        amount: number;
        amountInr: number;
        currency: string;
        keyId: string;
        prefill: {
            name: string;
            email: string;
            contact: string;
        };
    }>;
    verifyPayment(id: string, input: {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
    }): Promise<{
        alreadyCompleted: boolean;
        shopifyOrderId: string;
        orderName: string | null;
        orderStatusUrl?: undefined;
        commerceOrderId?: undefined;
    } | {
        alreadyCompleted: boolean;
        shopifyOrderId: string;
        orderName: string;
        orderStatusUrl: string | null;
        commerceOrderId: any;
    }>;
    acceptQuote(id: string): Promise<CommerceQuote>;
    cancel(id: string): Promise<void>;
    delete(id: string): Promise<void>;
    deleteFromLead(id: string, leadId: string): Promise<void>;
};
export {};
//# sourceMappingURL=commerce-quote.service.d.ts.map