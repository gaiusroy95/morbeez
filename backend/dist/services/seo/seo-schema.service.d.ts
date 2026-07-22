export declare const seoSchemaService: {
    buildProductSchema(input: {
        name: string;
        description: string;
        sku?: string;
        image?: string;
        price?: number;
        url: string;
        brand?: string;
    }): {
        '@context': string;
        '@type': string;
        name: string;
        description: string;
        sku: string | undefined;
        image: string | undefined;
        brand: {
            '@type': string;
            name: string;
        };
        offers: {
            '@type': string;
            priceCurrency: string;
            price: number;
            availability: string;
            url: string;
        } | undefined;
    };
    buildFaqSchema(faqs: Array<{
        question: string;
        answer: string;
    }>): {
        '@context': string;
        '@type': string;
        mainEntity: {
            '@type': string;
            name: string;
            acceptedAnswer: {
                '@type': string;
                text: string;
            };
        }[];
    };
    buildBreadcrumbSchema(items: Array<{
        name: string;
        url: string;
    }>): {
        '@context': string;
        '@type': string;
        itemListElement: {
            '@type': string;
            position: number;
            name: string;
            item: string;
        }[];
    };
    buildArticleSchema(input: {
        title: string;
        description: string;
        url: string;
        datePublished?: string;
    }): {
        '@context': string;
        '@type': string;
        headline: string;
        description: string;
        url: string;
        datePublished: string;
        author: {
            '@type': string;
            name: string;
        };
    };
    buildReviewSchema(input: {
        productName: string;
        rating: number;
        reviewCount: number;
    }): {
        '@context': string;
        '@type': string;
        name: string;
        aggregateRating: {
            '@type': string;
            ratingValue: number;
            reviewCount: number;
        };
    };
    bundleForProduct(input: {
        product: {
            name: string;
            description: string;
            sku?: string;
            image?: string;
            price?: number;
            url: string;
            brand?: string;
        };
        faqs?: Array<{
            question: string;
            answer: string;
        }>;
        breadcrumbs?: Array<{
            name: string;
            url: string;
        }>;
    }): {
        '@context': string;
        '@graph': Record<string, unknown>[];
    };
};
//# sourceMappingURL=seo-schema.service.d.ts.map