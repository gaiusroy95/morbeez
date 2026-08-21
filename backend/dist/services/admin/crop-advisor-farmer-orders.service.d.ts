export type CropAdvisorOrderLine = {
    title: string;
    quantity: number;
    price?: number;
    imageUrl?: string | null;
    shopifyProductId?: string | null;
    shopifyVariantId?: string | null;
    sku?: string | null;
};
export type CropAdvisorOrderRow = {
    id: string;
    orderId: string;
    orderRef: string | null;
    createdAt: string;
    dateLabel: string;
    lineItems: CropAdvisorOrderLine[];
    productTitle: string;
    productImageUrl: string | null;
    qty: number;
    amount: number;
    status: string;
    statusLabel: string;
    statusTone: string;
    paymentLabel: string;
    paymentSubtext: string;
    paymentTone: string;
    deliveryDateLabel: string;
    deliveryBy: string;
    trackingAwb?: string | null;
    trackingUrl?: string | null;
    courier?: string | null;
    blockName: string | null;
    blockId: string | null;
    source: 'crm_manual' | 'commerce';
    commerceOrderId?: string | null;
    notes?: string | null;
    deliveryAddress?: string | null;
    createdBy?: string | null;
};
export declare const cropAdvisorFarmerOrdersService: {
    listForFarmer(farmerId: string): Promise<{
        orders: CropAdvisorOrderRow[];
    }>;
    getDetail(farmerId: string, orderId: string): Promise<CropAdvisorOrderRow>;
};
//# sourceMappingURL=crop-advisor-farmer-orders.service.d.ts.map