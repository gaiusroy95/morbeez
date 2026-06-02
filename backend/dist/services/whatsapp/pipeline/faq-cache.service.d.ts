import type { AdvisoryLanguage } from '../../ai/types.js';
/**
 * Short keywords like "hi" must not match inside "this" / "machine".
 * Longer phrases may use substring match.
 */
export declare function faqKeywordMatches(normalizedText: string, keyword: string): boolean;
export declare function shouldSkipFaqForMessage(text: string): boolean;
export declare const faqCacheService: {
    faqKeywordMatches: typeof faqKeywordMatches;
    match(text: string, language: AdvisoryLanguage): Promise<string | null>;
};
//# sourceMappingURL=faq-cache.service.d.ts.map