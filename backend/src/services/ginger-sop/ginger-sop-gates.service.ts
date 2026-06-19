import type {
  GingerGateDecision,
  GingerSopRoute,
  GingerTriageLevel,
} from '../../domain/ginger-sop/types.js';

type GateInput = {
  identityComplete: boolean;
  evidenceCompleteness: number;
  evidenceTier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  triageLevel: GingerTriageLevel;
  fusedConfidence: number;
  hasSoilForNutrientRec: boolean;
  needsNutrientAdvice: boolean;
  channel: 'whatsapp' | 'api' | 'web' | 'field_visit' | 'telecaller';
};

export const gingerSopGatesService = {
  evaluate(input: GateInput): { route: GingerSopRoute; gates: GingerGateDecision[] } {
    const gates: GingerGateDecision[] = [];

    gates.push({
      gate: 'G0_identity',
      passed: input.identityComplete,
      reason: input.identityComplete
        ? 'Farmer/plot/crop identity sufficient'
        : 'Missing plot or crop registration',
      action: input.identityComplete ? undefined : 'collect_evidence',
    });

    gates.push({
      gate: 'G1_evidence',
      passed: input.evidenceCompleteness >= 20 || input.channel === 'field_visit',
      reason:
        input.evidenceCompleteness >= 20
          ? `Evidence completeness ${input.evidenceCompleteness}%`
          : 'Insufficient photo evidence for ginger SOP',
      action: input.evidenceCompleteness >= 20 ? undefined : 'collect_evidence',
    });

    gates.push({
      gate: 'G2_triage',
      passed: input.triageLevel !== 'L4',
      reason: `Triage ${input.triageLevel}`,
      action:
        input.triageLevel === 'L4'
          ? 'emergency_callback'
          : input.triageLevel === 'L3'
            ? 'field_visit'
            : undefined,
    });

    const confPct = Math.round(input.fusedConfidence * 100);
    let confRoute: GingerSopRoute | undefined;
    if (confPct >= 90 && input.evidenceTier >= 'T2') confRoute = 'auto_recommend';
    else if (confPct >= 75) confRoute = 'agronomist_review';
    else if (confPct >= 50) confRoute = 'telecaller_validate';
    else confRoute = 'field_visit';

    gates.push({
      gate: 'G3_confidence',
      passed: confPct >= 50,
      reason: `Fused confidence ${confPct}% at tier ${input.evidenceTier}`,
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

    let route: GingerSopRoute = confRoute ?? 'telecaller_validate';

    if (!input.identityComplete && input.channel === 'whatsapp') {
      route = 'collect_evidence';
    } else if (input.triageLevel === 'L4') {
      route = 'emergency_callback';
    } else if (input.triageLevel === 'L3') {
      route = 'field_visit';
    } else if (input.evidenceCompleteness < 20 && input.channel === 'whatsapp') {
      route = 'collect_evidence';
    } else if (input.needsNutrientAdvice && !input.hasSoilForNutrientRec) {
      route = 'collect_evidence';
    }

    return { route, gates };
  },
};
