export declare const seoRegionalService: {
    list(region?: string): Promise<any[]>;
    upsert(input: {
        region: string;
        keyword: string;
        trendScore?: number;
        searchVolumeEstimate?: number;
        notes?: string;
        suggestedPageSlug?: string;
    }): Promise<any>;
};
//# sourceMappingURL=seo-regional.service.d.ts.map