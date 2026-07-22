export declare const seoGscService: {
    isConfigured(): boolean;
    getConfig(): Promise<{
        configured: boolean;
        siteUrl: any;
        connectedAt: any;
        lastSyncAt: any;
        syncStatus: any;
    }>;
    saveConfig(input: {
        siteUrl: string;
        refreshToken?: string;
    }): Promise<any>;
    getLatestSnapshot(): Promise<any>;
    /** Pull from GSC API when credentials exist; otherwise seed from keywords table */
    sync(): Promise<{
        ok: boolean;
        reason: string;
        snapshot?: undefined;
    } | {
        ok: boolean;
        snapshot: any;
        reason?: undefined;
    }>;
};
//# sourceMappingURL=seo-gsc.service.d.ts.map