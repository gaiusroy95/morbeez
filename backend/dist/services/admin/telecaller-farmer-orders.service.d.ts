export type TelecallerOrderLine = {
    title: string;
    quantity: number;
    price?: number;
    imageUrl?: string | null;
};
export type TelecallerOrderRow = {
    id: string;
    orderId: string;
    orderRef: string | null;
    createdAt: string;
    dateLabel: string;
    lineItems: TelecallerOrderLine[];
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
export declare const telecallerFarmerOrdersService: {
    listForFarmer(farmerId: string): Promise<{
        orders: TelecallerOrderRow[];
    }>;
    getDetail(farmerId: string, orderId: string): Promise<TelecallerOrderRow>;
};
//# sourceMappingURL=telecaller-farmer-orders.service.d.ts.map