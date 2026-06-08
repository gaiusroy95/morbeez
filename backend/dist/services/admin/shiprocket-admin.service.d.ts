export declare const shiprocketAdminService: {
    getOverview(): {
        configured: boolean;
        autoShipEnabled: boolean;
        shipAfterPackEnabled: boolean;
        dashboardUrl: string;
        webhookPath: string;
        webhookUrl: string | null;
        webhookTokenConfigured: boolean;
    };
    getAuthStatus(): Promise<import("../shiprocket/shiprocket.client.js").ShiprocketAuthStatus>;
    listPending(limit?: number): Promise<{
        pending: {
            id: string;
            shopifyOrderId: string;
            displayOrderId: string;
            orderName: string | null;
            phone: string | null;
            amount: number;
            financialStatus: string | null;
            fulfillmentStatus: string | null;
            createdAt: string;
        }[];
        total: number;
    }>;
    listRecentEvents(limit?: number): Promise<{
        events: {
            id: string;
            shopifyOrderId: string | null;
            provider: string;
            shipmentId: string | null;
            awb: string | null;
            courier: string | null;
            status: string | null;
            eventType: string | null;
            createdAt: string;
            orderName: string | null;
            phone: string | null;
        }[];
    }>;
    retryCreateShipment(shopifyOrderId: string): Promise<{
        ok: boolean;
        shopifyOrderId: string;
        trackingAwb: string | null;
        shipmentId: string | null;
        status: string | null;
        fulfillmentStatus: any;
    }>;
};
//# sourceMappingURL=shiprocket-admin.service.d.ts.map