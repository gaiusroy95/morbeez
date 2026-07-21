export const DEFAULT_TARGET_CONFIDENCE = 0.85;
function clampPercent(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
}
/** Normalize raw scores (0–1 or 0–100) into integer percents summing to 100 with unknown bucket. */
export function buildHypothesisDistribution(raw, targetConfidence = DEFAULT_TARGET_CONFIDENCE) {
    const cleaned = raw
        .map((h) => {
        const label = String(h.label ?? '').trim();
        if (!label || /^unknown$/i.test(label))
            return null;
        let w = h.weight ?? h.confidence ?? 0;
        if (w > 0 && w <= 1)
            w *= 100;
        return { label, weight: clampPercent(w) };
    })
        .filter((h) => h != null && h.weight > 0)
        .slice(0, 5);
    if (!cleaned.length) {
        return {
            hypotheses: [],
            unknownWeight: 100,
            topConfidence: 0,
            targetConfidence,
        };
    }
    let sum = cleaned.reduce((a, h) => a + h.weight, 0);
    const minUnknown = 2;
    let unknownWeight = minUnknown;
    if (sum > 100 - minUnknown) {
        const scale = (100 - minUnknown) / sum;
        for (const h of cleaned) {
            h.weight = clampPercent(h.weight * scale);
        }
        sum = cleaned.reduce((a, h) => a + h.weight, 0);
        unknownWeight = 100 - sum;
    }
    else {
        unknownWeight = 100 - sum;
    }
    if (unknownWeight < minUnknown) {
        const deficit = minUnknown - unknownWeight;
        const top = cleaned[0];
        if (top)
            top.weight = clampPercent(top.weight - deficit);
        unknownWeight = minUnknown;
    }
    const topConfidence = cleaned[0]?.weight ?? 0;
    return {
        hypotheses: cleaned,
        unknownWeight: clampPercent(unknownWeight),
        topConfidence: topConfidence / 100,
        targetConfidence,
    };
}
export function distributionThresholdReached(dist) {
    return dist.topConfidence >= dist.targetConfidence;
}
export function applyEvidenceDeltas(dist, deltas) {
    const weights = new Map();
    for (const h of dist.hypotheses) {
        weights.set(h.label, h.weight);
    }
    for (const d of deltas) {
        const current = weights.get(d.label) ?? 0;
        weights.set(d.label, clampPercent(current + d.delta));
    }
    let unknown = dist.unknownWeight;
    const unknownDelta = deltas.find((d) => /^unknown$/i.test(d.label))?.delta ?? 0;
    unknown = clampPercent(unknown + unknownDelta);
    const hypotheses = [...weights.entries()]
        .filter(([, w]) => w > 0)
        .map(([label, weight]) => ({ label, weight }))
        .sort((a, b) => b.weight - a.weight);
    const rawSum = hypotheses.reduce((a, h) => a + h.weight, 0) + unknown;
    if (rawSum !== 100 && rawSum > 0) {
        const scale = 100 / rawSum;
        for (const h of hypotheses) {
            h.weight = clampPercent(h.weight * scale);
        }
        unknown = clampPercent(unknown * scale);
        const after = hypotheses.reduce((a, h) => a + h.weight, 0);
        unknown = clampPercent(100 - after);
    }
    return buildHypothesisDistribution(hypotheses.map((h) => ({ label: h.label, weight: h.weight })), dist.targetConfidence);
}
//# sourceMappingURL=confidence-distribution.js.map