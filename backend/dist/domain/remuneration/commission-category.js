const RULES = [
    { key: 'soil_testing', pattern: /soil\s*test/i },
    { key: 'water_testing', pattern: /water\s*test/i },
    { key: 'monitoring_package', pattern: /monitor(ing)?\s*pack/i },
    { key: 'advisory_package', pattern: /advisor(y)?\s*pack/i },
    { key: 'dealer_order', pattern: /\bdealer\b/i },
    { key: 'fpo_order', pattern: /\bfpo\b/i },
    {
        key: 'biologicals',
        pattern: /tricho|pseudomon|bacillus|mycorrhiz|biological|bio[- ]?fert|consortia|metarhiz|beauveria|paecilomyces|verticillium/i,
    },
    {
        key: 'high_margin_specialty',
        pattern: /micronutrient|seaweed|specialty|humic|amino|chelate|zinc\s*edta|boron/i,
    },
    { key: 'commodity_fertilizers', pattern: /\b(urea|mop|sop|dap fertilizer|18[-:]46[-:]0|20[-:]20[-:]0)\b/i },
    { key: 'generic_fertilizers', pattern: /fertilizer|npk|19[-:]19[-:]19|12[-:]32[-:]16|complex/i },
];
export function resolveCommissionCategory(input) {
    const kind = String(input.orderKind ?? '').toLowerCase();
    if (kind.includes('dealer'))
        return 'dealer_order';
    if (kind.includes('fpo'))
        return 'fpo_order';
    const blob = [input.productType, input.sku, input.title].filter(Boolean).join(' ');
    for (const rule of RULES) {
        if (rule.pattern.test(blob))
            return rule.key;
    }
    return 'biologicals';
}
export function dominantCategory(lines) {
    if (!lines.length)
        return 'biologicals';
    const scored = new Map();
    for (const line of lines) {
        const key = resolveCommissionCategory(line);
        scored.set(key, (scored.get(key) ?? 0) + Math.max(0, line.salesInr));
    }
    return [...scored.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'biologicals';
}
export function isCommercialOrder(grossInr) {
    return grossInr > 30_000;
}
export function reliabilityHoldPct(score) {
    if (score >= 70)
        return 0;
    if (score >= 50)
        return 20;
    return 100;
}
//# sourceMappingURL=commission-category.js.map