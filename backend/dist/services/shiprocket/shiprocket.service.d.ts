export type ShiprocketProvisionResult = {
    shiprocketOrderId: string | null;
    shipmentId: string | null;
    awb: string | null;
    courier: string | null;
    labelUrl: string | null;
    trackingUrl: string | null;
};
declare function getWalletBalance(): Promise<number | null>;
/** Delhivery is assigned via Shiprocket courier rules — no separate API in M2 */
export declare const shiprocketService: {
    getWalletBalance: typeof getWalletBalance;
    provisionForCommerceOrder(commerceOrderId: string, opts?: {
        forceRecreate?: boolean;
    }): Promise<ShiprocketProvisionResult | null>;
    _provisionForCommerceOrderOnce(commerceOrderId: string, alreadyRecreated: boolean): Promise<ShiprocketProvisionResult | null>;
    createShipmentForShopifyOrder(shopifyOrderId: string): Promise<{
        awb: string | null;
        courier: string;
    } | null>;
    handleTrackingWebhook(body: Record<string, unknown>): Promise<void>;
};
export {};
//# sourceMappingURL=shiprocket.service.d.ts.map