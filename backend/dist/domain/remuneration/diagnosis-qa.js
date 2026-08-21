export const DEFAULT_DIAGNOSIS_QA_RULE = {
    sampleRatePct: 10,
    sampleCap: 30,
};
/** MIN(rate% of qualified cases, cap). Never sample more than the qualified set. */
export function diagnosisQaSampleSize(qualifiedCount, rule = DEFAULT_DIAGNOSIS_QA_RULE) {
    const n = Math.max(0, Math.floor(Number(qualifiedCount) || 0));
    const rate = Math.max(0, Number(rule.sampleRatePct) || 0) / 100;
    const cap = Math.max(0, Math.floor(Number(rule.sampleCap) || 0));
    const fromRate = Math.ceil(n * rate);
    return Math.min(n, cap, fromRate);
}
export function diagnosisAccuracyPct(accurate, inaccurate) {
    const a = Math.max(0, Number(accurate) || 0);
    const i = Math.max(0, Number(inaccurate) || 0);
    const denom = a + i;
    if (denom <= 0)
        return 0;
    return Math.round((a / denom) * 1000) / 10;
}
function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function seedFrom(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
/** Stable shuffle so the same month redraws the same sample unless ids change. */
export function pickSample(items, size, seed) {
    const n = Math.min(Math.max(0, size), items.length);
    const copy = [...items];
    const rand = mulberry32(seedFrom(seed));
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
}
//# sourceMappingURL=diagnosis-qa.js.map