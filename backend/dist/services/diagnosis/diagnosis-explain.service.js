function chainLine(rc) {
    const lines = [];
    const symptoms = rc?.symptoms?.filter(Boolean) ?? [];
    if (symptoms.length)
        lines.push(symptoms.join(', '));
    if (rc?.immediateCause?.trim())
        lines.push(rc.immediateCause.trim());
    if (rc?.rootCause?.trim())
        lines.push(rc.rootCause.trim());
    return lines;
}
export const diagnosisExplainService = {
    explain(input) {
        const diagnosis = input.finalDiagnosis?.trim() || input.issueName.trim() || 'the field issue';
        const chain = chainLine(input.rootCause);
        const topHyp = input.hypotheses?.[0];
        const farmerParts = [
            `What we see: ${input.observation?.trim() || 'field symptoms match ' + diagnosis}.`,
            `Most likely: ${diagnosis}.`,
        ];
        if (chain.length >= 2) {
            farmerParts.push(`This often happens when ${chain[chain.length - 1]?.toLowerCase()}.`);
        }
        farmerParts.push('Your agronomist will confirm the plan and follow up after treatment.');
        const agroParts = [
            `Diagnosis: ${diagnosis}`,
            input.severity ? `Severity: ${input.severity}` : null,
            chain.length
                ? `Causal chain: ${chain.join(' → ')}`
                : topHyp?.rationale
                    ? `Rationale: ${topHyp.rationale}`
                    : null,
            topHyp
                ? `Top hypothesis: ${topHyp.label} (${Math.round(topHyp.confidence * 100)}%)`
                : null,
            input.hypotheses && input.hypotheses.length > 1
                ? `Differential: ${input.hypotheses
                    .slice(1, 4)
                    .map((h) => h.label)
                    .join(', ')}`
                : null,
        ].filter(Boolean);
        return {
            farmerText: farmerParts.join(' '),
            agronomistText: agroParts.join('\n'),
        };
    },
};
//# sourceMappingURL=diagnosis-explain.service.js.map