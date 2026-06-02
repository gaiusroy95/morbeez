const RULES = [
    {
        crops: ['ginger', 'rice', 'paddy'],
        issue: 'Pyricularia leaf blast',
        spreadMode: 'airborne',
        minScore: 55,
        phases: ['monsoon', 'disease_peak'],
        requiresHighHumidity: true,
        symptomHints: /blast|pyricularia|diamond|spindle|brown.?spot|leaf.?spot|lesion/i,
        reasoningEn: 'Monsoon/high humidity favours Pyricularia (blast) on ginger — spores spread by wind and rain splash.',
    },
    {
        crops: ['ginger'],
        issue: 'Rhizome rot / Pythium',
        spreadMode: 'soil',
        minScore: 50,
        phases: ['monsoon'],
        requiresHeavyRain: true,
        symptomHints: /rot|wilt|yellow|collar|soft|damp|waterlog/i,
        reasoningEn: 'Heavy rain and poor drainage increase rhizome rot risk in ginger.',
    },
    {
        crops: ['ginger', 'cardamom', 'pepper'],
        issue: 'Thrips',
        spreadMode: 'vector',
        minScore: 40,
        phases: ['monsoon', 'normal', 'planting'],
        symptomHints: /silver|streak|scrap|curl|thrip/i,
        reasoningEn: 'Thrips often rise after rains; silvery streaks on leaves are typical.',
    },
    {
        crops: ['cardamom', 'pepper', 'ginger'],
        issue: 'Anthracnose / fungal leaf spot',
        spreadMode: 'airborne',
        minScore: 48,
        requiresHighHumidity: true,
        symptomHints: /spot|anthracnose|fungus|blight|circular/i,
        reasoningEn: 'Warm humid weather supports airborne fungal leaf spots.',
    },
];
function scoreRule(rule, ctx, symptomsText) {
    let score = 0;
    if (rule.phases?.length && ctx.seasonPhase && rule.phases.includes(ctx.seasonPhase)) {
        score += 25;
    }
    if (rule.requiresHeavyRain && ctx.heavyRainLikely)
        score += 30;
    if (rule.requiresHighHumidity && ctx.highHumidityLikely)
        score += 28;
    if (ctx.weatherRiskScore >= 60)
        score += 15;
    if (symptomsText && rule.symptomHints?.test(symptomsText))
        score += 35;
    if (!rule.phases && ctx.seasonPhase === 'monsoon')
        score += 10;
    return score;
}
export const diseaseWeatherRulesService = {
    evaluate(params) {
        const crop = params.cropType.toLowerCase().replace(/_/g, ' ');
        const text = params.symptomsText ?? '';
        const priors = [];
        for (const rule of RULES) {
            if (!rule.crops.some((c) => crop.includes(c) || c.includes(crop)))
                continue;
            const score = scoreRule(rule, params.env, text);
            if (score < rule.minScore)
                continue;
            const likelihood = score >= rule.minScore + 35 ? 'high' : score >= rule.minScore + 15 ? 'medium' : 'low';
            priors.push({
                issueLabel: rule.issue,
                likelihood,
                spreadMode: rule.spreadMode,
                reasoning: rule.reasoningEn,
            });
        }
        return priors
            .sort((a, b) => {
            const rank = { high: 3, medium: 2, low: 1 };
            return rank[b.likelihood] - rank[a.likelihood];
        })
            .slice(0, 4);
    },
    formatForPrompt(priors) {
        if (!priors.length)
            return '';
        return priors
            .map((p) => `- ${p.issueLabel} (${p.likelihood} likelihood${p.spreadMode ? `, ${p.spreadMode} spread` : ''}): ${p.reasoning}`)
            .join('\n');
    },
};
//# sourceMappingURL=disease-weather-rules.service.js.map