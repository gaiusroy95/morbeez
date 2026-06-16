import type {
  BlockHealthLevel,
  CropPerformanceLevel,
  IssueCategory,
  MeasurementTemplate,
  SoilMoistureLevel,
  StructuredVisitIssueInput,
  VisitAiCaseStatus,
  VisitPhotoInput,
  VisitReviewSubStep,
} from '../types/field-findings';
import {
  isRejectReviewIncomplete,
  validateRejectReasonFlow,
  VISIT_AI_REJECT_REASON_OPTIONS,
  visitAiCaseStatusLabel,
} from './reject-flow';

export {
  VISIT_AI_REJECT_REASON_OPTIONS,
  validateRejectReasonFlow,
  isRejectReviewIncomplete,
  visitAiCaseStatusLabel,
  defaultEvidenceQuestions,
  buildCustomRecommendationText,
} from './reject-flow';
export type { RejectReasonValidationPayload } from './reject-flow';

export type VisitWizardStep =
  | 'overview'
  | 'photos'
  | 'measurements'
  | 'soilWeather'
  | 'issues'
  | 'aiAnalysis'
  | 'followUp'
  | 'finalDiagnosis'
  | 'recPlanning'
  | 'recApproval'
  | 'review'
  | 'summary';

export const VISIT_WIZARD_STEPS: Array<{ id: VisitWizardStep; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'photos', label: 'Photos' },
  { id: 'measurements', label: 'Measures' },
  { id: 'soilWeather', label: 'Soil' },
  { id: 'issues', label: 'Issues' },
  { id: 'aiAnalysis', label: 'AI' },
  { id: 'followUp', label: 'Q&A' },
  { id: 'finalDiagnosis', label: 'Diagnosis' },
  { id: 'recPlanning', label: 'Rec plan' },
  { id: 'recApproval', label: 'Rec OK' },
  { id: 'review', label: 'Review' },
  { id: 'summary', label: 'Summary' },
];

/** Read-only farm + block context shown on visit overview (Step 1). */
export type VisitFarmContext = {
  farmerPhone?: string | null;
  village?: string | null;
  district?: string | null;
  acreage?: number | null;
  area?: string | null;
  irrigationType?: string | null;
  varietyName?: string | null;
  plantingDate?: string | null;
  expectedHarvestDate?: string | null;
  recentVisits?: Array<{
    id: string;
    dateLabel: string;
    summary: string;
    agronomistName?: string | null;
  }>;
  recentRecommendations?: Array<{
    id: string;
    title: string;
    dateLabel: string;
    status: string;
  }>;
  recentApplications?: Array<{
    id: string;
    label: string;
    dateLabel: string;
    activityType: string;
  }>;
};

export type VisitEnvironmentSoilMetric = {
  key: string;
  label: string;
  value: string;
  unit: string;
  group: 'macro' | 'micro';
};

export type VisitEnvironmentPayload = {
  soilReport: {
    reportedAt: string | null;
    labName: string | null;
    soilType: string | null;
    metrics: VisitEnvironmentSoilMetric[];
  } | null;
  weather: {
    current: Record<string, unknown> | null;
    forecast: Record<string, unknown> | null;
  };
};

export type VisitPhotoValidationIssue = 'blur' | 'dark' | 'low_resolution';

export type VisitPhotoValidationResult = {
  ok: boolean;
  issues: VisitPhotoValidationIssue[];
  retakeRecommended: boolean;
};

export type RecommendationGroupMaterialDraft = {
  localId: string;
  issueLocalId: string;
  category: string;
  technicalName: string;
  dose?: string;
  method?: string;
  relatedIssueLocalId?: string;
};

export type RecommendationGroupDraft = {
  localId: string;
  applicationType: string;
  applicationDay: number;
  sortOrder: number;
  materials: RecommendationGroupMaterialDraft[];
};

export type VisitPhotoDraft = {
  filename: string;
  mimeType: string;
  dataBase64: string;
  photoType?: string;
  previewUrl?: string;
  validationIssues?: VisitPhotoValidationIssue[];
  retakeRecommended?: boolean;
};

export type VisitIssueDraft = StructuredVisitIssueInput & {
  localId: string;
  selectedHypothesisLabel?: string;
  aiCaseId?: string;
  finalDiagnosis?: string;
  finalRecommendation?: string;
  reviewAfterDays?: number;
  skipFollowUpOptional?: boolean;
  qaSkipped?: boolean;
  confidenceAction?: string;
  imageSignal?: { label: string; confidence: number };
  hypotheses?: Array<{
    label: string;
    confidence: number;
    rationale?: string;
    selected?: boolean;
    imagePrediction?: string;
    imageConfidence?: number;
  }>;
  followUpQuestions?: Array<{
    id: string;
    questionText: string;
    answerType: string;
    answer?: string;
  }>;
  similarCases?: Array<{ issueLabel: string; score: number; confidence: number; outcome?: string | null }>;
  agronomistReview?: StructuredVisitIssueInput['agronomistReview'];
  reviewSubStep?: VisitReviewSubStep;
  visitAiCaseStatus?: VisitAiCaseStatus | string;
};

export type VisitWizardValidationContext = {
  templates: MeasurementTemplate[];
  measurements: Record<string, string>;
  issues: VisitIssueDraft[];
  recommendationGroups?: RecommendationGroupDraft[];
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  partnerMode?: boolean;
};

export function mergeVisitPhotosIntoIssues(
  issues: VisitIssueDraft[],
  visitPhotos: VisitPhotoDraft[]
): Array<Omit<VisitIssueDraft, 'localId'> & { photos?: VisitPhotoInput[] }> {
  const sharedPhotos: VisitPhotoInput[] = visitPhotos.map((p) => ({
    filename: p.filename,
    mimeType: p.mimeType,
    dataBase64: p.dataBase64,
    photoType: p.photoType,
  }));
  return issues.map((issue, index) => {
    const { localId: _localId, ...rest } = issue;
    return {
      ...rest,
      photos: [...(issue.photos ?? []), ...(index === 0 ? sharedPhotos : [])],
    };
  });
}

export function validateVisitWizardStep(
  step: VisitWizardStep,
  ctx: VisitWizardValidationContext
): string | null {
  if (step === 'overview') {
    if (!ctx.blockHealth || !ctx.cropPerformance || !ctx.soilMoisture) {
      return 'Select block health, crop performance, and soil moisture on the Overview step.';
    }
  }
  if (step === 'measurements') {
    for (const tpl of ctx.templates) {
      if (tpl.required && !ctx.measurements[tpl.measurementKey]?.trim()) {
        return `Required measurement: ${tpl.labelEn}`;
      }
    }
  }
  if (step === 'issues') {
    if (!ctx.issues.length) return 'Add at least one issue.';
    for (const issue of ctx.issues) {
      if (!issue.issueName.trim()) return 'Each issue needs a name.';
    }
  }
  if (step === 'aiAnalysis') {
    for (const issue of ctx.issues) {
      if (!issue.aiCaseId) return 'Wait for AI analysis to complete.';
      if (!issue.finalDiagnosis?.trim()) return 'Select a primary hypothesis for each issue.';
    }
  }
  if (step === 'followUp') {
    for (const issue of ctx.issues) {
      if (issue.qaSkipped || issue.skipFollowUpOptional) continue;
      const qs = issue.followUpQuestions ?? [];
      if (qs.length && qs.some((q) => !q.answer?.trim())) {
        return 'Answer all follow-up questions, skip Q&A, or save answers and update diagnosis.';
      }
    }
  }
  if (step === 'finalDiagnosis') {
    for (const issue of ctx.issues) {
      if (!issue.finalDiagnosis?.trim()) return 'Each issue needs a final diagnosis before continuing.';
    }
  }
  if (step === 'recPlanning') {
    const groups = ctx.recommendationGroups ?? [];
    if (!groups.length) return 'Add at least one recommendation group.';
    for (const group of groups) {
      if (!group.applicationType.trim()) return 'Each group needs an application type.';
      if (!group.materials.length) return 'Each group needs at least one material.';
      for (const m of group.materials) {
        if (!m.technicalName.trim()) return 'Each material needs a product name.';
      }
    }
  }
  if (step === 'recApproval') {
    if (ctx.partnerMode) return null;
    if (!(ctx.recommendationGroups ?? []).length) {
      return 'Complete recommendation planning before approval.';
    }
  }
  if (step === 'review') {
    for (const issue of ctx.issues) {
      if (!issue.agronomistReview?.action) return 'Record a review decision for each issue.';
      const action = issue.agronomistReview.action;
      if (isRejectReviewIncomplete(issue.agronomistReview)) {
        return 'Complete the reject recommendation workflow before continuing.';
      }
      if (action === 'reject_recommendation' && issue.agronomistReview.rejectReason) {
        const err = validateRejectReasonFlow(issue.agronomistReview.rejectReason, {
          ...issue.agronomistReview,
          finalRecommendation: issue.finalRecommendation,
        });
        if (err) return err;
        continue;
      }
      if (
        (action === 'correct_ai' || action === 'partial_match' || action === 'escalate_urgent') &&
        !issue.agronomistReview.modificationReason?.trim()
      ) {
        return 'Provide a reason when modifying or rejecting AI output.';
      }
    }
  }
  return null;
}

/** Map legacy draft step ids to current wizard steps. */
export function normalizeVisitWizardStep(step: string): VisitWizardStep {
  if (step === 'recommendation') return 'recPlanning';
  const known = VISIT_WIZARD_STEPS.find((s) => s.id === step);
  return known?.id ?? 'overview';
}

export type VisitDraftPayload = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  blockHealth?: BlockHealthLevel;
  cropPerformance?: CropPerformanceLevel;
  soilMoisture?: SoilMoistureLevel;
  selectedCategories?: IssueCategory[];
  issues?: StructuredVisitIssueInput[];
  measurements?: Record<string, string>;
  recommendationGroups?: RecommendationGroupDraft[];
  savedAt: string;
};

export const VISIT_DRAFT_PREFIX = 'agronomist_visit_draft_';
