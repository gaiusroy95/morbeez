export declare const seoSitemapService: {
    list(): Promise<any[]>;
    generateAll(): Promise<{
        generated: any[];
        note: string;
    }>;
    markSubmitted(sitemapId: string): Promise<any>;
};
//# sourceMappingURL=seo-sitemap.service.d.ts.map