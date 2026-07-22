type CouponSyncInput = {
    code: string;
    discountLabel: string;
    minOrderAmount: number;
    usageLimit: number;
    validUntil: string;
};
type FlashSaleSyncInput = {
    shopifyProductId: string;
    flashPrice: number;
    originalPrice: number;
};
export declare const shopifyCampaignsService: {
    getConnectionStatus(): Promise<{
        connected: boolean;
        storeDomain: string;
        storefrontUrl: string;
        productCount: number;
        storeMismatch: boolean;
        message: string;
    }>;
    syncCoupon(input: CouponSyncInput): Promise<{
        ok: boolean;
        reason?: string;
    }>;
    syncFlashSalePrice(input: FlashSaleSyncInput): Promise<{
        ok: boolean;
        reason?: string;
    }>;
};
export {};
//# sourceMappingURL=shopify-campaigns.service.d.ts.map