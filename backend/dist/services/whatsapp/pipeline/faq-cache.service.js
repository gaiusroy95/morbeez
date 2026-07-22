import { supabase } from '../../../lib/supabase.js';
import { isConversationFollowUp, shouldUseConversationalContinuation, } from './conversation-continuation.service.js';
import { isExplicitAgronomyQuestion } from './agriculture-free-text.service.js';
let cache = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Short keywords like "hi" must not match inside "this" / "machine".
 * Longer phrases may use substring match.
 */
export function faqKeywordMatches(normalizedText, keyword) {
    const kw = keyword.toLowerCase().trim();
    if (!kw)
        return false;
    if (kw.length <= 4) {
        return new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i').test(normalizedText);
    }
    return normalizedText.includes(kw);
}
async function loadFaqs() {
    if (cache && Date.now() - cacheAt < CACHE_TTL_MS)
        return cache;
    const { data } = await supabase
        .from('advisory_faq_cache')
        .select('id, faq_key, keywords, hit_count, response_en, response_ml, response_ta, response_kn, response_hi')
        .eq('active', true);
    cache = (data ?? []);
    cacheAt = Date.now();
    return cache;
}
function pickResponse(row, language) {
    if (language === 'ml' && row.response_ml)
        return row.response_ml;
    if (language === 'ta' && row.response_ta)
        return row.response_ta;
    if (language === 'kn' && row.response_kn)
        return row.response_kn;
    if (language === 'hi' && row.response_hi)
        return row.response_hi;
    return row.response_en;
}
export function shouldSkipFaqForMessage(text) {
    const t = text.trim();
    if (!t)
        return false;
    if (isExplicitAgronomyQuestion(t))
        return true;
    if (shouldUseConversationalContinuation(t))
        return true;
    if (isConversationFollowUp(t))
        return true;
    return false;
}
export const faqCacheService = {
    faqKeywordMatches,
    async match(text, language) {
        const normalized = text.toLowerCase().trim();
        if (normalized.length < 2)
            return null;
        if (shouldSkipFaqForMessage(text))
            return null;
        const faqs = await loadFaqs();
        for (const row of faqs) {
            const hit = row.keywords.some((kw) => faqKeywordMatches(normalized, kw));
            if (!hit)
                continue;
            void supabase
                .from('advisory_faq_cache')
                .update({ hit_count: row.hit_count + 1, updated_at: new Date().toISOString() })
                .eq('id', row.id);
            return pickResponse(row, language);
        }
        return null;
    },
};
//# sourceMappingURL=faq-cache.service.js.map