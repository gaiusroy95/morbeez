/** Strip fields partners must never receive in API responses. */
const FORBIDDEN_KEYS = new Set([
    'margin',
    'profit',
    'roi',
    'clv',
    'customerLifetimeValue',
    'reliabilityScore',
    'performanceScore',
    'leadAllocationWeight',
    'commissionRate',
    'aiConfidence',
    'confidenceScore',
    'confidence',
    'finalConfidence',
    'fraudFlag',
]);
export function sanitizePartnerPayload(value) {
    if (value == null || typeof value !== 'object')
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => sanitizePartnerPayload(item));
    }
    const out = {};
    for (const [key, val] of Object.entries(value)) {
        if (FORBIDDEN_KEYS.has(key))
            continue;
        out[key] = sanitizePartnerPayload(val);
    }
    return out;
}
/** Strip confidence scores from visit AI responses for partner mobile. */
export function sanitizeVisitAiForPartner(value) {
    return sanitizePartnerPayload(value);
}
//# sourceMappingURL=partner-response-sanitizer.js.map