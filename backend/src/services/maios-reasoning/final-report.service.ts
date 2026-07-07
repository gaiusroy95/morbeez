import type {
  DiagnosisFinalReport,
  SafetyValidationResult,
  ScientificManagementPlan,
} from '../../domain/maios-reasoning/management-types.js';
import type {
  ReasoningDecision,
  ReasoningEvidenceItem,
  ReasoningExplanation,
} from '../../domain/maios-reasoning/types.js';

function buildFarmerSummary(params: {
  explanation: ReasoningExplanation;
  management: ScientificManagementPlan | null;
  safety: SafetyValidationResult | null;
  decision: ReasoningDecision;
}): string {
  const parts: string[] = [];
  if (params.explanation.diagnosis) {
    parts.push(
      `Most likely problem: ${params.explanation.diagnosis} (${Math.round(params.explanation.confidence * 100)}% confidence).`
    );
  }
  if (params.decision.action === 'CONTINUE') {
    parts.push('We need a bit more information before confirming the plan.');
    if (params.explanation.missing.length) {
      parts.push(`Still helpful: ${params.explanation.missing.slice(0, 2).join(', ')}.`);
    }
    return parts.join(' ');
  }
  if (params.management?.cultural.length) {
    parts.push(`First steps: ${params.management.cultural.slice(0, 2).join('; ')}.`);
  }
  if (params.safety?.status === 'REJECT') {
    parts.push('Some chemical options are not safe right now — your agronomist will adjust the plan.');
  } else {
    parts.push('Your agronomist will confirm the full treatment plan.');
  }
  return parts.join(' ');
}

function buildAgronomistSummary(params: {
  explanation: ReasoningExplanation;
  management: ScientificManagementPlan | null;
  safety: SafetyValidationResult | null;
  decision: ReasoningDecision;
}): string {
  const lines: string[] = [
    `Decision: ${params.decision.action}`,
    params.decision.reason,
  ];
  if (params.explanation.diagnosis) {
    lines.push(
      `Diagnosis: ${params.explanation.diagnosis} (${Math.round(params.explanation.confidence * 100)}%)`
    );
  }
  if (params.explanation.supporting.length) {
    lines.push(`Supporting: ${params.explanation.supporting.join('; ')}`);
  }
  if (params.explanation.rejected.length) {
    lines.push(`Rejected: ${params.explanation.rejected.join(', ')}`);
  }
  if (params.management) {
    lines.push(`IPM: ${params.management.ipm.join('; ')}`);
    if (params.management.chemical.length) {
      lines.push(
        `Chemical classes: ${params.management.chemical.map((c) => c.activeIngredientClass).join(', ')}`
      );
    }
  }
  if (params.safety) {
    lines.push(`Safety: ${params.safety.status}`);
    for (const r of params.safety.rejectReasons) lines.push(`  - ${r}`);
  }
  return lines.join('\n');
}

/** Domain 10 — structured final report for API and visit/WhatsApp surfaces. */
export const maiosFinalReportService = {
  build(params: {
    decision: ReasoningDecision;
    explanation: ReasoningExplanation;
    evidence: ReasoningEvidenceItem[];
    management: ScientificManagementPlan | null;
    safety: SafetyValidationResult | null;
    nextStepLabel: string | null;
  }): DiagnosisFinalReport {
    return {
      version: '17.0',
      diagnosis: params.explanation.diagnosis,
      confidence: params.explanation.confidence,
      decision: params.decision.action,
      evidence: params.evidence
        .filter((e) => !e.key.startsWith('photo:missing'))
        .slice(0, 12)
        .map((e) => ({
          label: e.label,
          source: e.source,
          reliability: Math.round(e.reliability * 100) / 100,
        })),
      explanation: {
        supporting: params.explanation.supporting,
        rejected: params.explanation.rejected,
        missing: params.explanation.missing,
      },
      management: params.management,
      safety: params.safety,
      nextStep: params.nextStepLabel,
      farmerSummary: buildFarmerSummary({
        explanation: params.explanation,
        management: params.management,
        safety: params.safety,
        decision: params.decision,
      }),
      agronomistSummary: buildAgronomistSummary({
        explanation: params.explanation,
        management: params.management,
        safety: params.safety,
        decision: params.decision,
      }),
    };
  },
};
