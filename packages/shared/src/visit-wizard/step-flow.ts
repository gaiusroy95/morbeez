import type { RecordSeverity } from '../types/field-findings';
import type { VisitWizardStep } from './index';

type StepFlowIssue = {
  aiCaseId?: string;
  qaSkipped?: boolean;
  skipFollowUpOptional?: boolean;
  confidenceAction?: string;
  agronomistReview?: { action?: string };
  hypotheses?: Array<{ selected?: boolean; confidence?: number }>;
  photoRequests?: Array<{ photoType: string }>;
};

type StepFlowCtx = {
  issues: StepFlowIssue[];
  partnerMode?: boolean;
};

const FOLLOW_UP_CONFIDENCE_THRESHOLD = 0.85;

export function issueTopConfidence(issue: StepFlowIssue): number {
  const fromHyp = issue.hypotheses?.find((h) => h.selected) ?? issue.hypotheses?.[0];
  if (fromHyp?.confidence != null) return fromHyp.confidence;
  return issue.confidenceAction === 'auto_send' ? 0.92 : issue.confidenceAction === 'employee_review' ? 0.75 : 0.55;
}

export function derivePhotoRequestsFromFollowUp(
  questions: Array<{ questionText: string; answer?: string }>
): Array<{ photoType: string; label: string; reason?: string }> {
  const requests: Array<{ photoType: string; label: string; reason?: string }> = [];
  const seen = new Set<string>();
  for (const q of questions) {
    const needsPhoto =
      /photo|image|picture|close.?up|leaf sample|send.*(pic|shot)/i.test(q.questionText) &&
      (!q.answer?.trim() || q.answer === 'unknown' || q.answer === 'no');
    if (!needsPhoto) continue;
    const photoType = /leaf/i.test(q.questionText)
      ? 'leaf'
      : /stem|stalk/i.test(q.questionText)
        ? 'stem'
        : /root|rhizome/i.test(q.questionText)
          ? 'rhizome'
          : 'disease';
    const key = `${photoType}:${q.questionText.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    requests.push({
      photoType,
      label: q.questionText.slice(0, 72),
      reason: 'Follow-up Q&A needs visual confirmation',
    });
  }
  return requests;
}

export function shouldRunFollowUp(issue: StepFlowIssue): boolean {
  if (!issue.aiCaseId) return false;
  if (issue.qaSkipped || issue.skipFollowUpOptional) return false;
  const action = issue.agronomistReview?.action;
  if (action === 'correct_ai' || action === 'partial_match' || action === 'reject_recommendation') return true;
  if (action === 'escalate_urgent') return true;
  if (issue.confidenceAction === 'escalate') return true;
  if (issueTopConfidence(issue) < FOLLOW_UP_CONFIDENCE_THRESHOLD) return true;
  return false;
}

export function hasPhotoRequests(issues: StepFlowIssue[]): boolean {
  return issues.some((i) => (i.photoRequests?.length ?? 0) > 0);
}

export function canSkipStep(step: VisitWizardStep, ctx: StepFlowCtx): boolean {
  if (step === 'followUp') {
    return !ctx.issues.some(shouldRunFollowUp);
  }
  if (step === 'additionalPhotos') {
    return !hasPhotoRequests(ctx.issues);
  }
  if (step === 'recApproval' && ctx.partnerMode) return true;
  return false;
}

export function getVisibleWizardSteps(partnerMode?: boolean): VisitWizardStep[] {
  return (
    [
      'overview',
      'photos',
      'measurements',
      'soilWeather',
      'aiAnalysis',
      'agronomistReview',
      'followUp',
      'additionalPhotos',
      'finalDiagnosis',
      'recPlanning',
      'applicationSchedule',
      'recApproval',
      'monitoringPlan',
      'whatsappPreview',
      'summary',
      'caseClosure',
    ] as VisitWizardStep[]
  ).filter((id) => !(partnerMode && id === 'recApproval'));
}

export function getNextWizardStep(current: VisitWizardStep, ctx: StepFlowCtx): VisitWizardStep | null {
  const steps = getVisibleWizardSteps(ctx.partnerMode);
  const idx = steps.indexOf(current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  for (let i = idx + 1; i < steps.length; i++) {
    const next = steps[i]!;
    if (!canSkipStep(next, ctx)) return next;
  }
  return null;
}

export function getPrevWizardStep(current: VisitWizardStep, ctx: StepFlowCtx): VisitWizardStep | null {
  const steps = getVisibleWizardSteps(ctx.partnerMode);
  const idx = steps.indexOf(current);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const prev = steps[i]!;
    if (!canSkipStep(prev, ctx)) return prev;
  }
  return null;
}

export function inferSeverityFromMeasurements(
  measurements: Record<string, string>,
  confidence: number
): RecordSeverity {
  const incidence = parseFloat(measurements.disease_incidence_pct ?? measurements.incidence_pct ?? '');
  const severity = parseFloat(measurements.disease_severity_pct ?? measurements.damage_pct ?? '');
  const signal = Number.isFinite(severity) ? severity : Number.isFinite(incidence) ? incidence : confidence * 100;
  if (signal >= 60 || confidence < 0.55) return 'high';
  if (signal >= 30 || confidence < 0.75) return 'medium';
  return 'low';
}
