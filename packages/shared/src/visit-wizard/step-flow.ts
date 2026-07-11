import type { RecordSeverity } from '../types/field-findings';
import type { VisitWizardStep } from './index';

export type MaiosTriageLevel = 'L1' | 'L2' | 'L3' | 'L4';

export type TriagePreview = {
  level: MaiosTriageLevel;
  reason: string;
  route: 'fast' | 'standard' | 'complex' | 'critical';
  mandatoryFollowUp: boolean;
  blockAutoApprove: boolean;
};

type StepFlowIssue = {
  aiCaseId?: string;
  qaSkipped?: boolean;
  skipFollowUpOptional?: boolean;
  confidenceAction?: string;
  diagnosisSource?: string;
  escalationRequired?: boolean;
  thresholdReached?: boolean;
  agronomistReview?: { action?: string };
  hypotheses?: Array<{ selected?: boolean; confidence?: number; weight?: number }>;
  photoRequests?: Array<{ photoType: string }>;
};

type StepFlowCtx = {
  issues: StepFlowIssue[];
  partnerMode?: boolean;
  triage?: TriagePreview | null;
  confidenceThresholdReached?: boolean;
};

export const FOLLOW_UP_CONFIDENCE_THRESHOLD = 0.85;

export function issueTopConfidence(issue: StepFlowIssue): number {
  const fromHyp = issue.hypotheses?.find((h) => h.selected) ?? issue.hypotheses?.[0];
  if (fromHyp?.weight != null) return fromHyp.weight / 100;
  if (fromHyp?.confidence != null) return fromHyp.confidence;
  return issue.confidenceAction === 'auto_send' ? 0.92 : issue.confidenceAction === 'employee_review' ? 0.75 : 0.55;
}

export function derivePhotoRequestsFromFollowUp(
  questions: Array<{
    questionText: string;
    answer?: string;
    answerType?: string;
    imageTarget?: string;
  }>
): Array<{ photoType: string; label: string; reason?: string }> {
  const requests: Array<{ photoType: string; label: string; reason?: string }> = [];
  const seen = new Set<string>();
  for (const q of questions) {
    const isImageType = q.answerType === 'image_upload';
    const needsPhoto =
      (isImageType || /photo|image|picture|close.?up|leaf sample|send.*(pic|shot)/i.test(q.questionText)) &&
      (!q.answer?.trim() ||
        q.answer === 'unknown' ||
        q.answer === 'no' ||
        q.answer === 'Not available' ||
        q.answer === 'Need later');
    if (!needsPhoto) continue;
    const target = String(q.imageTarget ?? '').toLowerCase();
    const photoType = target.includes('leaf')
      ? 'leaf'
      : target.includes('stem')
        ? 'stem'
        : target.includes('root') || target.includes('rhizome')
          ? 'rhizome'
          : /leaf/i.test(q.questionText)
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

export function shouldRunFollowUp(issue: StepFlowIssue, ctx?: StepFlowCtx): boolean {
  if (issue.diagnosisSource === 'insufficient_evidence' || issue.escalationRequired) return false;
  if (!issue.aiCaseId) return true;
  if (issue.qaSkipped || issue.skipFollowUpOptional) return false;
  if (issue.thresholdReached || ctx?.confidenceThresholdReached) return false;
  if (ctx?.triage?.mandatoryFollowUp) return true;
  if (ctx?.triage?.level === 'L4') return true;
  const action = issue.agronomistReview?.action;
  if (action === 'correct_ai' || action === 'partial_match' || action === 'reject_recommendation') return true;
  if (action === 'escalate_urgent') return true;
  if (issue.confidenceAction === 'escalate') return true;
  if (ctx?.triage?.level === 'L1' && action === 'approve_ai') return false;
  if (issueTopConfidence(issue) < FOLLOW_UP_CONFIDENCE_THRESHOLD) return true;
  return false;
}

export function hasPhotoRequests(issues: StepFlowIssue[]): boolean {
  return issues.some((i) => (i.photoRequests?.length ?? 0) > 0);
}

export function canSkipStep(step: VisitWizardStep, ctx: StepFlowCtx): boolean {
  if (step === 'dynamicQA') {
    const hasScreenedCase = ctx.issues.some((i) => i.aiCaseId);
    if (!hasScreenedCase) return false;
    if (ctx.triage?.mandatoryFollowUp) return false;
    if (ctx.issues.some((i) => shouldRunFollowUp(i, ctx))) return false;
    return ctx.issues.every((i) => i.qaSkipped || i.skipFollowUpOptional || !i.aiCaseId);
  }
  if (step === 'aiDiagnosis') {
    return !ctx.issues.some((i) => i.aiCaseId);
  }
  return false;
}

export function getVisibleWizardSteps(_partnerMode?: boolean): VisitWizardStep[] {
  return [
    'intakeTriage',
    'photos',
    'fieldIntelligence',
    'dynamicQA',
    'aiDiagnosis',
    'diagnosisFinalization',
    'recommendationBuilder',
    'scheduleCompatibility',
    'farmerCommunication',
    'visitSummary',
    'followUpPlanning',
    'learningSubmit',
  ];
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

export function blockAutoApprove(ctx: StepFlowCtx): boolean {
  return ctx.triage?.blockAutoApprove === true || ctx.triage?.level === 'L4';
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
