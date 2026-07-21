import { maiosKnowledgeService } from './knowledge.service.js';
const MIN_PROB = 0.001;
function clampProb(n) {
    return Math.max(MIN_PROB, Math.min(0.999, n));
}
function toPercentEntries(weights) {
    const sum = [...weights.values()].reduce((a, b) => a + b, 0) || 1;
    return [...weights.entries()]
        .map(([label, w]) => ({ label, probability: clampProb(w / sum) }))
        .sort((a, b) => b.probability - a.probability);
}
export const maiosBayesianEngineService = {
    buildPrior(pkg, regionalBoost) {
        const weights = new Map();
        for (const label of pkg.diseaseLabels) {
            weights.set(label, pkg.defaultPriorWeight[label] ?? 0.05);
        }
        for (const rp of regionalBoost ?? []) {
            const match = [...weights.keys()].find((k) => k.toLowerCase().includes(rp.issueLabel.toLowerCase().slice(0, 8)));
            if (match) {
                weights.set(match, (weights.get(match) ?? 0.05) + rp.caseCount * 0.02);
            }
        }
        return toPercentEntries(weights);
    },
    update(pkg, prior, evidence) {
        const odds = new Map();
        for (const p of prior) {
            const prob = clampProb(p.probability);
            odds.set(p.label, prob / (1 - prob));
        }
        for (const label of pkg.diseaseLabels) {
            if (!odds.has(label))
                odds.set(label, MIN_PROB / (1 - MIN_PROB));
        }
        for (const item of evidence) {
            const rules = maiosKnowledgeService.listLikelihoodRatios(pkg, item.key);
            for (const rule of rules) {
                if (!odds.has(rule.diseaseLabel))
                    continue;
                if (item.key === 'regional:prior' && item.value) {
                    const target = String(item.value).toLowerCase();
                    const disease = rule.diseaseLabel.toLowerCase();
                    if (!disease.includes(target.slice(0, 8)) && !target.includes(disease.slice(0, 8))) {
                        continue;
                    }
                }
                const effectiveLr = Math.pow(rule.lr, item.reliability);
                odds.set(rule.diseaseLabel, (odds.get(rule.diseaseLabel) ?? 1) * effectiveLr);
            }
        }
        const weights = new Map();
        for (const [label, o] of odds) {
            weights.set(label, o / (1 + o));
        }
        return toPercentEntries(weights);
    },
    topConfidence(posterior) {
        return posterior[0]?.probability ?? 0;
    },
};
//# sourceMappingURL=bayesian-engine.service.js.map