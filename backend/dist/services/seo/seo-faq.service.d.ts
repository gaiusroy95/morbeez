export declare const seoFaqService: {
    list(opts?: {
        pageId?: string;
        productId?: string;
    }): Promise<any[]>;
    create(input: {
        pageId?: string;
        shopifyProductId?: string;
        question: string;
        answer: string;
        sortOrder?: number;
        schemaEnabled?: boolean;
        aiGenerated?: boolean;
    }): Promise<any>;
    update(id: string, input: Partial<{
        question: string;
        answer: string;
        sortOrder: number;
        schemaEnabled: boolean;
    }>): Promise<any>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
};
//# sourceMappingURL=seo-faq.service.d.ts.map