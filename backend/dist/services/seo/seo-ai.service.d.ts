export declare const seoAiService: {
    logJob(jobType: string, entityType: string | null, entityId: string | null, input: Record<string, unknown>, adminId?: string): Promise<string>;
    completeJob(jobId: string, output: Record<string, unknown>, failed?: string): Promise<void>;
    generateProductSeo(shopifyProductId: string, adminId?: string): Promise<{
        jobId: string;
        seo: {
            seoTitle: string;
            seoDescription: string;
            urlSlug: string;
            focusKeywords: string;
            aiVisibilityNotes: string;
            schemaNotes: string;
            aiGeneratedAt: string;
        };
        faqs: {
            question: string;
            answer: string;
        }[];
        schema: {
            '@context': string;
            '@graph': Record<string, unknown>[];
        };
        internalLinkSuggestions: {
            anchorText: string;
            targetHint: string;
        }[];
    }>;
    generateCropProblemContent(input: {
        crop: string;
        problem: string;
        stage?: string;
        region?: string;
    }, adminId?: string): Promise<{
        metaTitle: string;
        metaDescription: string;
        bodyHtml: string;
        faqs: Array<{
            question: string;
            answer: string;
        }>;
        focusKeywords: string[];
        relatedProductHints: string[];
        internalLinks: Array<{
            anchorText: string;
            targetSlug: string;
        }>;
        aiVisibilityStructure: string;
        pageId: any;
    }>;
    generateArticle(input: {
        topic: string;
        crop?: string;
        region?: string;
    }, adminId?: string): Promise<{
        title: string;
        metaTitle: string;
        metaDescription: string;
        bodyHtml: string;
        faqs: Array<{
            question: string;
            answer: string;
        }>;
        focusKeywords: string[];
        pageId: any;
    }>;
};
//# sourceMappingURL=seo-ai.service.d.ts.map