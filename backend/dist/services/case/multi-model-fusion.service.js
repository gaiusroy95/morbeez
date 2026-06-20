function labAnomalyHints(reports) {
    const hints = [];
    for (const r of reports ?? []) {
        if (r.type === 'leaf') {
            const n = Number(r.metrics?.nitrogen_pct ?? r.metrics?.N);
            if (Number.isFinite(n) && n < 2)
                hints.push('leaf_n_low');
        }
        if (r.type === 'pathogen' && r.metrics?.detected) {
            hints.push(String(r.metrics.detected));
        }
        if (r.type === 'soil') {
            const k = Number(r.metrics?.potassium_kg_ha ?? r.metrics?.K);
            if (Number.isFinite(k) && k < 100)
                hints.push('soil_k_low');
        }
    }
    return hints;
}
export const multiModelFusionService = {
    async enrichHypotheses(hypotheses, input) {
        const enriched = [...hypotheses];
        for (const prior of input.regionalPriors ?? []) {
            if (!prior.issueLabel)
                continue;
            const existing = enriched.find((h) => h.label.toLowerCase() === prior.issueLabel.toLowerCase());
            if (existing) {
                existing.probability = Math.min(95, existing.probability + Math.min(15, prior.caseCount));
                existing.source = 'M2';
            }
            else if (enriched.length < 5) {
                enriched.push({
                    label: prior.issueLabel,
                    probability: Math.min(60, 20 + prior.caseCount * 2),
                    source: 'M2',
                });
            }
        }
        for (const kg of input.kgCandidates ?? []) {
            const existing = enriched.find((h) => h.label.toLowerCase() === kg.label.toLowerCase());
            if (existing) {
                existing.probability = Math.min(95, existing.probability + Math.round(kg.weight * 10));
                existing.source = 'M3';
            }
            else if (enriched.length < 5) {
                enriched.push({
                    label: kg.label,
                    probability: Math.round(Math.min(70, kg.weight * 50)),
                    source: 'M3',
                });
            }
        }
        const labHints = labAnomalyHints(input.labReports);
        if (labHints.length && enriched[0]) {
            enriched[0] = {
                ...enriched[0],
                source: 'M4',
                probability: Math.min(95, enriched[0].probability + 8),
            };
        }
        const sorted = enriched
            .map((h, i) => ({
            ...h,
            source: i === 0 && h.source === 'ai' ? 'M1' : h.source,
        }))
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 5);
        if (input.hasPlantId && sorted[0]) {
            sorted[0] = { ...sorted[0], source: 'M5' };
        }
        const sources = new Set(sorted.map((h) => h.source));
        const activeModules = input.moduleScores.filter((m) => m.completeness > 50);
        const avgScore = activeModules.length > 0
            ? activeModules.reduce((s, m) => s + m.score, 0) / activeModules.length
            : 50;
        const modelAgreement = Math.round((input.modelConfidence * 100 * 0.4 +
            avgScore * 0.3 +
            (sources.size / 5) * 100 * 0.3) /
            100);
        return { hypotheses: sorted, modelAgreement };
    },
};
//# sourceMappingURL=multi-model-fusion.service.js.map