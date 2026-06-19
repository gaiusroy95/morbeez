import { getChannelProfile } from '../../domain/case/channel-profiles.js';
export const caseGatesService = {
    evaluate(input) {
        const gates = [];
        const profile = getChannelProfile(input.channel);
        gates.push({
            gate: 'G0_identity',
            passed: input.identityComplete,
            reason: input.identityComplete
                ? 'Farmer/plot/crop identity sufficient'
                : 'Missing plot or crop registration',
            action: input.identityComplete ? undefined : 'collect_evidence',
        });
        const evidenceOk = input.evidenceCompleteness >= profile.minCompletenessPct || input.channel === 'field_visit';
        gates.push({
            gate: 'G1_evidence',
            passed: evidenceOk,
            reason: evidenceOk
                ? `Evidence completeness ${input.evidenceCompleteness}% (EQS ${input.eqs})`
                : 'Insufficient photo evidence',
            action: evidenceOk ? undefined : 'collect_evidence',
        });
        gates.push({
            gate: 'G2_triage',
            passed: input.triageLevel !== 'L4',
            reason: `Triage ${input.triageLevel}`,
            action: input.triageLevel === 'L4'
                ? 'emergency_callback'
                : input.triageLevel === 'L3'
                    ? 'field_visit'
                    : undefined,
        });
        const confPct = Math.round(input.fusedConfidence * 100);
        let confRoute;
        if (input.eqs > 70 && confPct >= 75 && input.evidenceTier >= 'T2')
            confRoute = 'auto_recommend';
        else if (input.eqs >= 50 && confPct >= 60)
            confRoute = 'agronomist_review';
        else if (confPct >= 50)
            confRoute = 'telecaller_validate';
        else
            confRoute = 'field_visit';
        if (input.eqs < 50)
            confRoute = 'collect_evidence';
        gates.push({
            gate: 'G3_confidence',
            passed: input.eqs >= 50 && confPct >= 50,
            reason: `EQS ${input.eqs}, fused confidence ${confPct}% at tier ${input.evidenceTier}`,
            action: confRoute,
        });
        if (input.needsNutrientAdvice) {
            gates.push({
                gate: 'G4_soil',
                passed: input.hasSoilForNutrientRec,
                reason: input.hasSoilForNutrientRec
                    ? 'Soil data available for nutrient advice'
                    : 'Nutrient advice requires soil confirmation',
                action: input.hasSoilForNutrientRec ? undefined : 'collect_evidence',
            });
        }
        gates.push({
            gate: 'G5_recovery',
            passed: Boolean(input.recoveryScheduled),
            reason: input.recoveryScheduled
                ? 'Recovery validation loop scheduled'
                : 'Recovery loop pending schedule',
        });
        let route = confRoute ?? 'telecaller_validate';
        if (!input.identityComplete && input.channel === 'whatsapp') {
            route = 'collect_evidence';
        }
        else if (input.triageLevel === 'L4') {
            route = 'emergency_callback';
        }
        else if (input.triageLevel === 'L3') {
            route = 'field_visit';
        }
        else if (input.eqs < 50) {
            route = 'collect_evidence';
        }
        else if (!profile.allowAutoRecommend) {
            route = input.eqs > 70 ? 'agronomist_review' : 'telecaller_validate';
        }
        else if (input.needsNutrientAdvice && !input.hasSoilForNutrientRec) {
            route = 'collect_evidence';
        }
        return { route, gates };
    },
};
//# sourceMappingURL=case-gates.service.js.map