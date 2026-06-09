export declare const shopifyPublicationsService: {
    publishToOnlineStore(productId: string): Promise<void>;
    unpublishFromOnlineStore(productId: string): Promise<void>;
    syncProductVisibility(productId: string, status: "active" | "draft" | "archived"): Promise<void>;
    getConnectionStatus(): Promise<{
        connected: boolean;
        storeDomain: string;
        storefrontUrl: string;
        productCount: number;
        storeMismatch: boolean;
        message: string;
    }>;
};
//# sourceMappingURL=shopify.publications.service.d.ts.map