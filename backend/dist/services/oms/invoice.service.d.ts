export declare const invoiceService: {
    generateTaxInvoice(commerceOrderId: string): Promise<any>;
    generateQuotation(input: {
        customerName: string;
        customerState: string;
        customerGstin?: string;
        lines: Array<{
            description: string;
            hsnCode?: string;
            qty: number;
            unitPrice: number;
            gstPercent?: number;
        }>;
        freight?: number;
        validityDays?: number;
        razorpayPaymentLinkUrl?: string;
    }): Promise<any>;
    generateDeliveryChallan(commerceOrderId: string, purpose?: string): Promise<any>;
    generateDocument(commerceOrderId: string, documentType: "tax_invoice" | "delivery_challan"): Promise<any>;
    repairTaxInvoice(invoiceId: string): Promise<any>;
    getInvoice(invoiceId: string): Promise<any>;
    generateCreditNote(commerceOrderId: string, refundAmount: number, reason: string): Promise<any>;
};
//# sourceMappingURL=invoice.service.d.ts.map