export declare const bannersThemeSyncService: {
    syncFromShopifyTheme(): Promise<{
        imported: number;
        created: number;
        updated: number;
        themeId: number;
    }>;
    syncToShopifyTheme(): Promise<{
        themeId: number;
        heroSlides: number;
        promoUpdated: boolean;
    }>;
};
//# sourceMappingURL=banners-theme-sync.service.d.ts.map