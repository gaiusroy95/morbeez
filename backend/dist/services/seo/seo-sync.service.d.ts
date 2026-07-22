declare function storefrontBase(): string;
export declare const seoSyncService: {
    storefrontBase: typeof storefrontBase;
    syncProductToShopify(shopifyProductId: string): Promise<{
        ok: boolean;
        syncedAt: string;
        canonicalUrl: string;
    }>;
};
export {};
//# sourceMappingURL=seo-sync.service.d.ts.map