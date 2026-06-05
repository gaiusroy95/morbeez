export declare const seoProductService: {
    list(opts?: {
        search?: string;
        missingOnly?: boolean;
    }): Promise<{
        shopifyProductId: string;
        title: string;
        handle: string;
        imageUrl: string;
        seoTitle: string;
        seoDescription: string;
        urlSlug: string;
        focusKeywords: string;
        canonicalUrl: string;
        altTags: {
            id: string;
            src: string;
            alt: string;
        }[];
        faqCount: number;
        syncedAt: {} | null;
        complete: boolean;
        status: string;
    }[]>;
    get(shopifyProductId: string): Promise<{
        shopifyProductId: string;
        title: string;
        handle: string;
        intelligence: {
            shopifyProductId: unknown;
            basic: Record<string, unknown>;
            agriculture: Record<string, unknown>;
            aiMapping: Record<string, unknown>;
            seo: Record<string, unknown>;
            crossSell: Record<string, unknown>;
            updatedAt: unknown;
        };
    } | {
        intelligence: {
            shopifyProductId: unknown;
            basic: Record<string, unknown>;
            agriculture: Record<string, unknown>;
            aiMapping: Record<string, unknown>;
            seo: Record<string, unknown>;
            crossSell: Record<string, unknown>;
            updatedAt: unknown;
        };
        faqs: any[];
        shopifyProductId: string;
        title: string;
        handle: string;
        imageUrl: string;
        seoTitle: string;
        seoDescription: string;
        urlSlug: string;
        focusKeywords: string;
        canonicalUrl: string;
        altTags: {
            id: string;
            src: string;
            alt: string;
        }[];
        faqCount: number;
        syncedAt: {} | null;
        complete: boolean;
        status: string;
    }>;
    update(shopifyProductId: string, input: {
        seoTitle?: string;
        seoDescription?: string;
        urlSlug?: string;
        focusKeywords?: string;
        canonicalUrl?: string;
        altTags?: Array<{
            imageId: string;
            alt: string;
        }>;
    }, adminId?: string): Promise<{
        shopifyProductId: string;
        title: string;
        handle: string;
        intelligence: {
            shopifyProductId: unknown;
            basic: Record<string, unknown>;
            agriculture: Record<string, unknown>;
            aiMapping: Record<string, unknown>;
            seo: Record<string, unknown>;
            crossSell: Record<string, unknown>;
            updatedAt: unknown;
        };
    } | {
        intelligence: {
            shopifyProductId: unknown;
            basic: Record<string, unknown>;
            agriculture: Record<string, unknown>;
            aiMapping: Record<string, unknown>;
            seo: Record<string, unknown>;
            crossSell: Record<string, unknown>;
            updatedAt: unknown;
        };
        faqs: any[];
        shopifyProductId: string;
        title: string;
        handle: string;
        imageUrl: string;
        seoTitle: string;
        seoDescription: string;
        urlSlug: string;
        focusKeywords: string;
        canonicalUrl: string;
        altTags: {
            id: string;
            src: string;
            alt: string;
        }[];
        faqCount: number;
        syncedAt: {} | null;
        complete: boolean;
        status: string;
    }>;
    syncToShopify(shopifyProductId: string): Promise<{
        ok: boolean;
        syncedAt: string;
        canonicalUrl: string;
    }>;
};
//# sourceMappingURL=seo-product.service.d.ts.map