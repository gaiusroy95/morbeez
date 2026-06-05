export declare const seoShopifyPublishService: {
    publishToShopify(pageId: string): Promise<{
        shopifyPageId: string;
        handle: any;
        storefrontUrl: string;
        page: any;
    }>;
    unpublishFromShopify(pageId: string): Promise<{
        ok: boolean;
        skipped: boolean;
    } | {
        ok: boolean;
        skipped?: undefined;
    }>;
};
//# sourceMappingURL=seo-shopify-publish.service.d.ts.map