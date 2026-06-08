/** Delhivery is assigned via Shiprocket courier rules — no separate API in M2 */
export declare const shiprocketService: {
    createShipmentForShopifyOrder(shopifyOrderId: string): Promise<{
        awb: string | null;
        courier: string;
    } | null>;
    handleTrackingWebhook(body: Record<string, unknown>): Promise<void>;
};
//# sourceMappingURL=shiprocket.service.d.ts.map