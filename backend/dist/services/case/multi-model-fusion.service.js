export const multiModelFusionService = {
    enrichHypotheses(hypotheses, input) {
        const enriched = hypotheses.map((h, i) => ({
            ...h,
            source: i === 0 ? 'M1' : h.source,
        }));
        if (input.hasPlantId && enriched[0]) {
            enriched[0] = { ...enriched[0], source: 'M5' };
        }
        const activeModules = input.moduleScores.filter((m) => m.completeness > 50);
        const avgScore = activeModules.length > 0
            ? activeModules.reduce((s, m) => s + m.score, 0) / activeModules.length
            : 50;
        const modelAgreement = Math.round((input.modelConfidence * 100 * 0.6 + avgScore * 0.4) / 100);
        return { hypotheses: enriched, modelAgreement };
    },
};
//# sourceMappingURL=multi-model-fusion.service.js.map