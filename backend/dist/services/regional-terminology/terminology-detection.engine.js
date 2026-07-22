import { isExplicitAgronomyQuestion } from '../whatsapp/pipeline/agriculture-free-text.service.js';
import { terminologyDictionaryService } from './terminology-dictionary.service.js';
const INDIC_SCRIPT = /[\u0D00-\u0D7F\u0B80-\u0BFF\u0C80-\u0CFF\u0900-\u097F]/;
/** Tokens worth checking as potential regional crop terms. */
function extractCandidateTokens(message) {
    const t = message.trim();
    if (!t)
        return [];
    const tokens = [];
    const words = t.split(/\s+/).filter(Boolean);
    for (const w of words) {
        const bare = w.replace(/[^\p{L}\p{N}]/gu, '');
        if (bare.length < 2 || bare.length > 24)
            continue;
        if (/^(hi|hello|menu|yes|no|ok|did|done|have|was|i|we|the|aanu|aano|und|illa|varunnu|varilla|cheyy|check|yellow|weak|fine|good|bad)$/i.test(bare)) {
            continue;
        }
        tokens.push(bare);
    }
    if (INDIC_SCRIPT.test(t)) {
        const scriptChunks = t.match(/[\u0D00-\u0D7F\u0B80-\u0BFF\u0C80-\u0CFF\u0900-\u097F]+/gu) ?? [];
        for (const chunk of scriptChunks) {
            if (chunk.length >= 2 && chunk.length <= 12)
                tokens.push(chunk);
        }
    }
    return [...new Set(tokens)];
}
function isLikelyRegionalCandidate(token, fullMessage) {
    if (isExplicitAgronomyQuestion(fullMessage) && fullMessage.split(/\s+/).length > 4) {
        return token.length >= 3 && !/^\d+$/.test(token);
    }
    if (INDIC_SCRIPT.test(token))
        return true;
    if (/^[a-z]{3,14}$/i.test(token) && !/\b(can|how|what|why|when|mix|with|and|the)\b/i.test(token)) {
        return true;
    }
    return false;
}
function resolveDetectedSource(entry) {
    if (entry.source)
        return entry.source;
    if (entry.id.startsWith('farmer:'))
        return 'farmer';
    if (entry.id.startsWith('builtin:'))
        return 'builtin';
    return 'dictionary';
}
/**
 * Stage 2 — Regional Terminology Detection Engine
 * Tokenize → dictionary lookup → known vs unknown (never guess unknown).
 */
export const terminologyDetectionEngine = {
    extractCandidateTokens,
    async detect(params) {
        const rawMessage = params.rawMessage.trim();
        const candidates = extractCandidateTokens(rawMessage).filter((tok) => isLikelyRegionalCandidate(tok, rawMessage));
        const terms = [];
        for (const token of candidates) {
            const entry = await terminologyDictionaryService.lookup(token, params.language, {
                cropType: params.cropType,
                district: params.district,
                farmerId: params.farmerId,
            });
            if (entry) {
                terms.push({
                    token,
                    known: true,
                    meaning: entry.meaning,
                    standardTerm: entry.standardTerm ?? entry.meaning,
                    confidence: entry.confidence,
                    source: resolveDetectedSource(entry),
                    replyPreferred: entry.replyPreferred !== false,
                    conceptId: entry.conceptId ?? null,
                });
            }
            else {
                terms.push({
                    token,
                    known: false,
                    confidence: 0,
                    source: 'unknown',
                });
            }
        }
        const knownTerms = terms.filter((x) => x.known);
        const unknownTerms = terms.filter((x) => !x.known);
        const glossaryLines = knownTerms.map((x) => `${x.token} = ${x.standardTerm ?? x.meaning} (${x.meaning})`);
        let expandedForAi = rawMessage;
        for (const k of knownTerms) {
            const repl = k.standardTerm ?? k.meaning ?? '';
            if (repl) {
                const re = new RegExp(k.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                expandedForAi = expandedForAi.replace(re, repl);
            }
        }
        return {
            rawMessage,
            language: params.language,
            terms,
            knownTerms,
            unknownTerms,
            hasUnknown: unknownTerms.length > 0,
            expandedForAi,
            glossaryLines,
        };
    },
};
//# sourceMappingURL=terminology-detection.engine.js.map