import type {
  VisitAiCustomRecommendation,
  VisitAiEvidenceRequest,
  VisitAiRejectReason,
  VisitAgronomistReview,
  VisitReviewSubStep,
} from '../types/field-findings.js';

export const VISIT_AI_REJECT_REASON_OPTIONS: Array<{
  value: VisitAiRejectReason;
  label: string;
  description: string;
}> = [
  {
    value: 'wrong_diagnosis',
    label: 'Wrong Diagnosis',
    description: 'AI diagnosis is incorrect — enter the correct diagnosis and regenerate recommendation.',
  },
  {
    value: 'need_more_evidence',
    label: 'Need More Evidence',
    description: 'Request additional photos and answers from the farmer via WhatsApp.',
  },
  {
    value: 'recommendation_not_suitable',
    label: 'Recommendation Not Suitable',
    description: 'Diagnosis is fine but the suggested treatment does not fit this stage.',
  },
  {
    value: 'custom_recommendation',
    label: 'Create My Own Recommendation',
    description: 'Replace the AI product advice with your own prescription.',
  },
];

export function visitAiCaseStatusLabel(status?: string | null): string {
  if (!status) return '';
  const labels: Record<string, string> = {
    ai_suggested: 'AI Suggested',
    under_review: 'Under Review',
    need_more_evidence: 'Need More Evidence',
    waiting_farmer_response: 'Waiting Farmer Response',
    diagnosis_confirmed: 'Diagnosis Confirmed',
    recommendation_confirmed: 'Recommendation Confirmed',
    closed: 'Closed',
    recommended: 'AI Suggested',
    reviewed: 'Under Review',
    submitted: 'Closed',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

export type RejectReasonValidationPayload = Pick<
  VisitAgronomistReview,
  | 'rejectReason'
  | 'correctedDiagnosis'
  | 'rejectNote'
  | 'evidenceRequest'
  | 'customRecommendation'
  | 'finalRecommendation'
>;

export function validateRejectReasonFlow(
  reason: VisitAiRejectReason,
  payload: RejectReasonValidationPayload
): string | null {
  if (reason === 'wrong_diagnosis') {
    if (!payload.correctedDiagnosis?.trim()) return 'Enter the correct diagnosis.';
    return null;
  }
  if (reason === 'need_more_evidence') {
    const photos = payload.evidenceRequest?.photoTypes ?? [];
    if (!photos.length) return 'Select at least one photo type to request.';
    const qs = payload.evidenceRequest?.questions ?? [];
    if (qs.some((q) => !q.answer?.trim())) return 'Answer all evidence questions.';
    return null;
  }
  if (reason === 'recommendation_not_suitable') {
    if (!payload.rejectNote?.trim()) return 'Explain why the recommendation is not suitable.';
    if (!payload.finalRecommendation?.trim()) return 'Edit the recommendation before continuing.';
    return null;
  }
  if (reason === 'custom_recommendation') {
    const c = payload.customRecommendation;
    if (!c?.product?.trim()) return 'Enter the product name.';
    if (!c?.dose?.trim()) return 'Enter the dose.';
    if (!c?.method?.trim()) return 'Enter the application method.';
    return null;
  }
  return null;
}

export function isRejectReviewIncomplete(review?: VisitAgronomistReview | null): boolean {
  if (!review) return false;
  if (review.action !== 'reject_recommendation') return false;
  return !review.rejectFlowComplete || !review.rejectReason;
}

export function defaultEvidenceQuestions(): VisitAiEvidenceRequest['questions'] {
  return [
    { key: 'fungicide_applied', text: 'Has fungicide been applied?', answer: undefined },
    { key: 'water_standing', text: 'Is water standing in field?', answer: undefined },
  ];
}

export function buildCustomRecommendationText(custom: VisitAiCustomRecommendation): string {
  const parts = [
    custom.product.trim(),
    custom.dose.trim() ? `Dose: ${custom.dose.trim()}` : '',
    custom.method.trim() ? `Method: ${custom.method.trim()}` : '',
    custom.reviewDate ? `Review: ${custom.reviewDate}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}
