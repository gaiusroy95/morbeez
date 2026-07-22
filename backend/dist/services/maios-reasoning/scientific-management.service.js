function normalizeLabel(label) {
    return label.toLowerCase().replace(/\s+/g, ' ').trim();
}
function matchManagementRule(rules, diagnosisLabel) {
    const target = normalizeLabel(diagnosisLabel);
    return (rules.find((r) => normalizeLabel(r.diseaseLabel) === target) ??
        rules.find((r) => target.includes(normalizeLabel(r.diseaseLabel).slice(0, 12)) ||
            normalizeLabel(r.diseaseLabel).includes(target.slice(0, 12))) ??
        null);
}
/** Domain 8 — agronomic management from knowledge package (no product SKU mapping). */
export const maiosScientificManagementService = {
    build(params) {
        if (!params.locked || !params.diagnosisLabel)
            return null;
        const rules = params.pkg.managementRules ?? [];
        if (!rules.length)
            return null;
        const rule = matchManagementRule(rules, params.diagnosisLabel);
        if (!rule) {
            return {
                diagnosisLabel: params.diagnosisLabel,
                objectives: ['Confirm diagnosis with agronomist before treatment'],
                ipm: ['Continue field scouting'],
                cultural: ['Maintain drainage and canopy airflow'],
                nutrition: ['Follow soil test recommendations'],
                biological: [],
                chemical: [],
                monitoring: ['Re-assess in 7 days'],
            };
        }
        return {
            diagnosisLabel: rule.diseaseLabel,
            objectives: rule.objectives,
            ipm: rule.ipm,
            cultural: rule.cultural,
            nutrition: rule.nutrition,
            biological: rule.biological,
            chemical: rule.chemical,
            monitoring: rule.monitoring,
        };
    },
};
//# sourceMappingURL=scientific-management.service.js.map