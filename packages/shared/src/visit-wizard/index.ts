import type {
  BlockHealthLevel,
  CropPerformanceLevel,
  IssueCategory,
  MeasurementTemplate,
  SoilMoistureLevel,
  StructuredVisitIssueInput,
  VisitPhotoInput,
} from '../types/field-findings.js';

export type VisitWizardStep =
  | 'overview'
  | 'photos'
  | 'measurements'
  | 'issues'
  | 'aiAnalysis'
  | 'followUp'
  | 'recommendation'
  | 'review'
  | 'summary';

export const VISIT_WIZARD_STEPS: Array<{ id: VisitWizardStep; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'photos', label: 'Photos' },
  { id: 'measurements', label: 'Measures' },
  { id: 'issues', label: 'Issues' },
  { id: 'aiAnalysis', label: 'AI' },
  { id: 'followUp', label: 'Q&A' },
  { id: 'recommendation', label: 'Rec' },
  { id: 'review', label: 'Review' },
  { id: 'summary', label: 'Summary' },
];

export type VisitPhotoDraft = {
  filename: string;
  mimeType: string;
  dataBase64: string;
  photoType?: string;
  previewUrl?: string;
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
};

export type VisitWizardValidationContext = {
  templates: MeasurementTemplate[];
  measurements: Record<string, string>;
  issues: VisitIssueDraft[];
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
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
  if (step === 'recommendation') {
    for (const issue of ctx.issues) {
      if (!issue.finalRecommendation?.trim()) return 'Each issue needs a recommendation draft.';
    }
  }
  if (step === 'review') {
    for (const issue of ctx.issues) {
      if (!issue.agronomistReview?.action) return 'Record a review decision for each issue.';
      const action = issue.agronomistReview.action;
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
  savedAt: string;
};

export const VISIT_DRAFT_PREFIX = 'agronomist_visit_draft_';
