/** Detect farmer disagreement / correction intent (multilingual keywords). */
import { extractAllFarmerSuggestedDiagnoses, mapFarmerSuggestionInput, } from '../../domain/learning/farmer-nutrient-suggestions.js';
const DISAGREEMENT_PATTERNS = [
    /\b(ai\s+)?(is\s+)?wrong\b/i,
    /\bnot\s+(correct|right|fungus|disease|accurate)\b/i,
    /\bincorrect\b/i,
    /\bthis\s+is\s+(not|no)\b/i,
    /\b(this\s+is|its|it's)\s+\w+/i,
    /\balready\s+had\b/i,
    /\blast\s+(year|time|season)\b/i,
    /\bhappened\s+before\b/i,
    /\b(i\s+)?know\s+this\b/i,
    /\bതെറ്റ്\b/,
    /\bഎനിക്ക്\s+അറിയാം\b/,
    /\bകഴിഞ്ഞ\b/,
    /\bதவறு\b/,
    /\bநான்\s+அறிவேன்\b/,
];
const CORRECTION_ISSUE_PATTERNS = [
    /\b(this\s+is|its|it's)\s+(thrips?|mites?|aphids?|fungus|fungal|nematode|blight|rust|spot)\b/i,
    /\b(not\s+fungus|not\s+thrips)\b/i,
];
const PRIOR_TREATMENT_PATTERNS = [
    /\b(last\s+time|previously|before)\b/i,
    /\bworked\b/i,
    /\b(i\s+)?applied\b/i,
    /\b(spray|soil\s+application)\b/i,
    /\b(spinetoram|fipronil|mancozeb|azoxystrobin|copper|neem)\b/i,
    /\b(edta|sulfate|sulphate|ammonium)\b/i,
    /\bസ്പിനെടോറം\b/i,
];
export function isFarmerDisagreementIntent(text) {
    const t = text.trim();
    if (t.length < 4)
        return false;
    if (/^feedback\.(disagree|suggest\.)/i.test(t))
        return true;
    if (DISAGREEMENT_PATTERNS.some((p) => p.test(t)))
        return true;
    if (CORRECTION_ISSUE_PATTERNS.some((p) => p.test(t)))
        return true;
    if (mapFarmerSuggestionInput(t) !== undefined)
        return true;
    return false;
}
/**
 * Returns the first detected issue (chip / single-line flows). Use extractAllSuggestedDiagnoses for storage.
 */
export function extractSuggestedDiagnosis(text) {
    const all = extractAllSuggestedDiagnoses(text);
    return all[0] ?? null;
}
/** Each distinct issue from farmer free text — never one combined string. */
export function extractAllSuggestedDiagnoses(text) {
    const t = text.trim();
    if (!t)
        return [];
    if (/^feedback\.suggest\./i.test(t)) {
        const mapped = mapFarmerSuggestionInput(t);
        return typeof mapped === 'string' ? [mapped] : [];
    }
    const nutrients = extractAllFarmerSuggestedDiagnoses(t);
    if (nutrients.length)
        return nutrients;
    const mapped = mapFarmerSuggestionInput(t);
    if (typeof mapped === 'string')
        return [mapped];
    const m = t.match(/\b(?:this\s+is|its|it's|ഇത്)\s+([a-zA-Z\u0D00-\u0D7F\u0B80-\u0BFF\s,-]{2,200})/i);
    if (m?.[1]) {
        const parts = m[1]
            .split(/\s*,\s*|\s+and\s+/i)
            .map((p) => p.trim())
            .filter((p) => p.length >= 3);
        if (parts.length > 1)
            return parts.map((p) => p.slice(0, 120));
        return [m[1].trim().slice(0, 200)];
    }
    const pest = t.match(/\b(thrips?|mites?|aphids?|whitefly|borer|nematode|fungal?\s+infection|leaf\s+spot|blight)\b/i);
    if (pest?.[1])
        return [pest[1].trim()];
    return [];
}
export function extractPriorProduct(text) {
    const t = text.trim();
    if (!t)
        return null;
    const products = [];
    const patterns = [
        { re: /\bedta\s*(?:zinc|zn)\b/i, label: 'EDTA zinc' },
        { re: /\bedta\s*(?:ferrous|fe|iron)\b|\bferrous(?:\s*sul(?:ph|f)ate)?\b/i, label: 'EDTA ferrous' },
        { re: /\bedta\s*calcium\b/i, label: 'EDTA calcium' },
        { re: /\bmagnesium\s*sul(?:ph|f)ate\b/i, label: 'magnesium sulfate' },
        { re: /\bammonium\s*sul(?:ph|f)ate\b/i, label: 'ammonium sulfate' },
        { re: /\bzinc\s*sul(?:ph|f)ate\b/i, label: 'zinc sulfate' },
        { re: /\bferrous\s*sul(?:ph|f)ate\b/i, label: 'ferrous sulfate' },
        { re: /\bspinetoram\b/i, label: 'spinetoram' },
        { re: /\bfipronil\b/i, label: 'fipronil' },
        { re: /\bmancozeb\b/i, label: 'mancozeb' },
        { re: /\bazoxystrobin\b/i, label: 'azoxystrobin' },
        { re: /\btebuconazole\b/i, label: 'tebuconazole' },
        { re: /\bcopper\s*oxychloride\b/i, label: 'copper oxychloride' },
        { re: /\bneem\b/i, label: 'neem' },
        { re: /\bprofenofos\b/i, label: 'profenofos' },
        { re: /\bdimethoate\b/i, label: 'dimethoate' },
    ];
    for (const p of patterns) {
        if (p.re.test(t) && !products.includes(p.label))
            products.push(p.label);
    }
    if (products.length)
        return products.join(', ').slice(0, 400);
    const m = t.match(/\b(spinetoram|fipronil|mancozeb|azoxystrobin|tebuconazole|copper\s+oxychloride|neem|profenofos|dimethoate)\b/i);
    return m?.[1] ? m[1].trim() : null;
}
export function looksLikePriorExperience(text) {
    return PRIOR_TREATMENT_PATTERNS.some((p) => p.test(text));
}
//# sourceMappingURL=farmer-feedback-intent.service.js.map