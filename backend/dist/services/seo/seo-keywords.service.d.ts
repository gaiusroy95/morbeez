export declare const seoKeywordsService: {
    list(opts?: {
        region?: string;
        search?: string;
    }): Promise<any[]>;
    upsert(input: {
        keyword: string;
        targetType?: string;
        targetId?: string;
        region?: string;
        position?: number;
        impressions?: number;
        clicks?: number;
        ctr?: number;
        organicTraffic?: number;
    }): Promise<any>;
    importRows(rows: Array<Record<string, unknown>>): Promise<any[]>;
};
//# sourceMappingURL=seo-keywords.service.d.ts.map