export declare const seoStorefrontService: {
    listPublished(opts?: {
        pageType?: string;
        crop?: string;
        limit?: number;
    }): Promise<{
        url: string;
        id: any;
        slug: any;
        title: any;
        meta_description: any;
        page_type: any;
        crop: any;
        problem: any;
        stage: any;
        region: any;
        published_at: any;
    }[]>;
    getBySlug(slug: string): Promise<{
        id: any;
        slug: any;
        title: any;
        metaTitle: any;
        metaDescription: any;
        pageType: any;
        crop: any;
        problem: any;
        stage: any;
        region: any;
        bodyHtml: any;
        focusKeywords: any;
        faqs: {
            q: any;
            a: any;
        }[];
        schema: any;
        internalLinks: any[];
        relatedProducts: {
            id: string;
            title: string;
            handle: string;
            imageUrl: string;
            price: string;
            url: string;
        }[];
        canonicalUrl: any;
        url: string;
        publishedAt: any;
    }>;
    resolveProducts(shopifyProductIds: string[]): Promise<{
        id: string;
        title: string;
        handle: string;
        imageUrl: string;
        price: string;
        url: string;
    }[]>;
};
//# sourceMappingURL=seo-storefront.service.d.ts.map