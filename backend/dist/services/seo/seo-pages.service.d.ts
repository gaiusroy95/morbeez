export declare const seoPagesService: {
    list(opts?: {
        pageType?: string;
        status?: string;
        crop?: string;
        search?: string;
    }): Promise<any[]>;
    get(id: string): Promise<any>;
    create(input: {
        pageType: string;
        title: string;
        slug?: string;
        metaTitle?: string;
        metaDescription?: string;
        crop?: string;
        problem?: string;
        stage?: string;
        region?: string;
        bodyHtml?: string;
        focusKeywords?: string[];
        relatedProductIds?: string[];
        status?: string;
    }, adminId?: string): Promise<any>;
    update(id: string, input: Record<string, unknown>): Promise<any>;
    /** Dynamic page from crop + problem + stage inputs */
    generateCropProblemPage(input: {
        crop: string;
        problem: string;
        stage?: string;
        region?: string;
    }, adminId?: string): Promise<any>;
};
//# sourceMappingURL=seo-pages.service.d.ts.map