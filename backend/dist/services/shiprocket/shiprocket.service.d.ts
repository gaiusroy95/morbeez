export type ShiprocketProvisionResult = {
    shiprocketOrderId: string | null;
    shipmentId: string | null;
    awb: string | null;
    courier: string | null;
    labelUrl: string | null;
    trackingUrl: string | null;
};
/** Delhivery is assigned via Shiprocket courier rules — no separate API in M2 */
export declare const shiprocketService: {
    provisionForCommerceOrder(commerceOrderId: string): Promise<ShiprocketProvisionResult | null>;
    createShipmentForShopifyOrder(shopifyOrderId: string): Promise<{
        awb: string | null;
        courier: string;
    } | null>;
    handleTrackingWebhook(body: Record<string, unknown>): Promise<void>;
};
//# sourceMappingURL=shiprocket.service.d.ts.map