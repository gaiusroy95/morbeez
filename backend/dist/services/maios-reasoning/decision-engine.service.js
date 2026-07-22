const DEFAULT_THRESHOLD = 0.85;
const MIN_EVIDENCE_FOR_LOCK = 3;
export const maiosDecisionEngineService = {
    evaluate(params) {
        const threshold = params.threshold ?? DEFAULT_THRESHOLD;
        const top = params.posterior[0];
        const topConfidence = top?.probability ?? 0;
        const topLabel = top?.label && top.label !== 'Unknown' ? top.label : null;
        const reliableEvidence = params.evidence.filter((e) => e.reliability >= 0.7 && !e.key.startsWith('photo:missing'));
        const evidenceCount = reliableEvidence.length;
        const reviewRequired = Boolean(params.escalationRecommended) ||
            params.maiosRoute === 'agronomist_review' ||
            params.maiosRoute === 'field_visit' ||
            params.eqs < 50;
        if (topConfidence >= threshold &&
            evidenceCount >= MIN_EVIDENCE_FOR_LOCK &&
            !reviewRequired &&
            topLabel) {
            return {
                action: 'LOCK',
                topLabel,
                topConfidence,
                threshold,
                evidenceCount,
                reviewRequired: false,
                reason: `Posterior ${Math.round(topConfidence * 100)}% with ${evidenceCount} reliable evidence items`,
            };
        }
        const reasons = [];
        if (topConfidence < threshold) {
            reasons.push(`confidence ${Math.round(topConfidence * 100)}% below ${Math.round(threshold * 100)}%`);
        }
        if (evidenceCount < MIN_EVIDENCE_FOR_LOCK) {
            reasons.push(`only ${evidenceCount} reliable evidence items (need ${MIN_EVIDENCE_FOR_LOCK})`);
        }
        if (reviewRequired)
            reasons.push('human review required by MAIOS route or EQS');
        return {
            action: 'CONTINUE',
            topLabel,
            topConfidence,
            threshold,
            evidenceCount,
            reviewRequired,
            reason: reasons.join('; ') || 'Continue evidence collection',
        };
    },
};
//# sourceMappingURL=decision-engine.service.js.map