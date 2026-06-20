import type {

  BlockHealthLevel,

  CropPerformanceLevel,

  IssueCategory,

  MeasurementTemplate,

  RecordSeverity,

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

import {
  isFieldLevelPhotoType,
  isSymptomPhotoType,
  photoRequirementHint,
} from './photo-categories';

export {

  isManualDiagnosis,

  manualDiagnosisDisplayValue,

  applyHypothesisSelection,

  applyManualDiagnosis,

} from './diagnosis-helpers';

export {

  PROVISIONAL_ISSUE_NAME,

  createProvisionalVisitIssue,

  ensureIssuesForAiStep,

  isProvisionalIssueName,

  seedIssueFromAnalysis,

} from './ai-first';

export type { VisitAnalyzeSeedInput } from './ai-first';

import {
  shouldRunFollowUp,
  derivePhotoRequestsFromFollowUp,
  hasPhotoRequests,
  canSkipStep,
  getVisibleWizardSteps,
  getNextWizardStep,
  getPrevWizardStep,
  issueTopConfidence,
  inferSeverityFromMeasurements,
} from './step-flow';

export {
  shouldRunFollowUp,
  derivePhotoRequestsFromFollowUp,
  hasPhotoRequests,
  canSkipStep,
  getVisibleWizardSteps,
  getNextWizardStep,
  getPrevWizardStep,
  issueTopConfidence,
  inferSeverityFromMeasurements,
} from './step-flow';

export {
  isFieldLevelPhotoType,
  isSymptomPhotoType,
  photoRequirementHint,
  resolveCapturePhotoType,
  suggestNextCapturePhotoType,
  mapClassifierCategoryToVisitPhotoType,
} from './photo-categories';

export {
  DOSE_BASIS_OPTIONS,
  DOSE_UNIT_OPTIONS,
  MATERIAL_APPLICATION_MODE_OPTIONS,
  defaultRecommendationMaterial,
  formatMaterialDose,
  formatMaterialApplicationMode,
  mapRecommendationGroupsForSubmit,
} from './recommendation-material';

export type { DoseBasis, DoseUnit, MaterialApplicationMode, RecommendationGroupDraft, RecommendationGroupMaterialDraft } from './recommendation-material';

export { buildPriorRecommendationFollowUps } from './prior-recommendation-followups';

export type {
  PriorRecommendationFollowUpDraft,
  PriorRecommendationFollowUpSource,
} from './prior-recommendation-followups';



export type VisitWizardStep =

  | 'overview'

  | 'photos'

  | 'measurements'

  | 'soilWeather'

  | 'aiAnalysis'

  | 'agronomistReview'

  | 'followUp'

  | 'additionalPhotos'

  | 'finalDiagnosis'

  | 'recPlanning'

  | 'applicationSchedule'

  | 'recApproval'

  | 'monitoringPlan'

  | 'whatsappPreview'

  | 'summary'

  | 'caseClosure';



export const VISIT_WIZARD_STEPS: Array<{ id: VisitWizardStep; label: string }> = [

  { id: 'overview', label: 'Overview' },

  { id: 'photos', label: 'Photos' },

  { id: 'measurements', label: 'Measures' },

  { id: 'soilWeather', label: 'Soil' },

  { id: 'aiAnalysis', label: 'AI' },

  { id: 'agronomistReview', label: 'Review' },

  { id: 'followUp', label: 'Q&A' },

  { id: 'additionalPhotos', label: 'More photos' },

  { id: 'finalDiagnosis', label: 'Diagnosis' },

  { id: 'recPlanning', label: 'Rec plan' },

  { id: 'applicationSchedule', label: 'Day plan' },

  { id: 'recApproval', label: 'Rec OK' },

  { id: 'monitoringPlan', label: 'Monitor' },

  { id: 'whatsappPreview', label: 'WhatsApp' },

  { id: 'summary', label: 'Summary' },

  { id: 'caseClosure', label: 'Learning' },

];



export type VisitAiRootCause = {

  symptoms?: string[];

  photoSignals?: string[];

  soilSignals?: string[];

  weatherSignals?: string[];

  conclusion?: string;

};



export type VisitAiEvidencePack = {

  photoSummary?: string;

  measurementSummary?: string;

  soilSummary?: string;

  weatherSummary?: string;

  historySummary?: string;

};



export type VisitAiInitialRecommendation = {

  text: string;

  dose?: string;

  method?: string;

  category?: string;

};



export type VisitPhotoRequest = {

  photoType: string;

  label: string;

  reason?: string;

};



export type MonitoringPlanPreviewItem = {

  localId: string;

  issueLocalId: string;

  issueLabel: string;

  intervalDays: number;

  checkType: string;

  severity: RecordSeverity;

};



export type WhatsappPreviewMessage = {

  issueIndex: number;

  issueLabel: string;

  message: string;

  compliancePrompt?: string;

};



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



export type VisitPhotoValidationIssue = 'blur' | 'dark' | 'low_resolution' | 'coverage';



export type VisitPhotoValidationResult = {

  ok: boolean;

  issues: VisitPhotoValidationIssue[];

  retakeRecommended: boolean;

};



export type RecommendationGroupMaterialDraft = import('./recommendation-material.js').RecommendationGroupMaterialDraft;

export type RecommendationGroupDraft = import('./recommendation-material.js').RecommendationGroupDraft;



export type VisitPhotoDraft = {

  filename: string;

  mimeType: string;

  dataBase64: string;

  photoType?: string;

  previewUrl?: string;

  validationIssues?: VisitPhotoValidationIssue[];

  retakeRecommended?: boolean;

  aiTagged?: boolean;

  uri?: string;

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

  aiConfidence?: number;

  aiSeverity?: RecordSeverity;

  rootCause?: VisitAiRootCause;

  evidence?: VisitAiEvidencePack;

  initialRecommendation?: VisitAiInitialRecommendation;

  photoRequests?: VisitPhotoRequest[];

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

  visitPhotos?: VisitPhotoDraft[];

  recommendationGroups?: RecommendationGroupDraft[];

  monitoringPlan?: MonitoringPlanPreviewItem[];

  whatsappConfirmed?: boolean;

  whatsappMessages?: WhatsappPreviewMessage[];

  recApproved?: boolean;

  blockHealth: BlockHealthLevel | null;

  cropPerformance: CropPerformanceLevel | null;

  soilMoisture: SoilMoistureLevel | null;

  partnerMode?: boolean;

};



const MIN_FIELD_PHOTOS = 1;

const MIN_SYMPTOM_PHOTOS = 1;



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



function validateAgronomistReview(issues: VisitIssueDraft[]): string | null {

  if (!issues.length) return 'Add at least one issue.';

  for (const issue of issues) {

    if (!issue.issueName.trim()) return 'Each issue needs a name.';

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

      if (!issue.observation?.trim()) return 'Provide observation when rejecting an issue.';

      continue;

    }

    if (action === 'correct_ai' || action === 'partial_match') {

      if (!issue.observation?.trim()) return 'Provide observation when modifying an issue.';

      if (!issue.agronomistReview.modificationReason?.trim()) {

        return 'Provide a reason when modifying AI output.';

      }

    }

  }

  return null;

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

  if (step === 'photos') {

    const photos = ctx.visitPhotos ?? [];

    if (!photos.length) return 'Capture at least one field photo.';

    const fieldCount = photos.filter((p) => isFieldLevelPhotoType(p.photoType)).length;

    const symptomCount = photos.filter((p) => isSymptomPhotoType(p.photoType)).length;

    if (fieldCount < MIN_FIELD_PHOTOS) {
      const tagged = photos.map((p) => p.photoType).filter(Boolean).join(', ') || 'untagged';
      return `Add at least one field-level photo (e.g. Whole field). Current tags: ${tagged}.`;
    }

    if (symptomCount < MIN_SYMPTOM_PHOTOS) {
      const tagged = photos.map((p) => p.photoType).filter(Boolean).join(', ') || 'untagged';
      return `Add at least one symptom close-up (e.g. Leaf, Disease, or Rhizome). Current tags: ${tagged}.`;
    }

    const bad = photos.filter((p) => p.retakeRecommended || (p.validationIssues?.length ?? 0) > 0);

    if (bad.length) return 'Retake photos flagged for blur, lighting, resolution, or coverage.';

  }

  if (step === 'measurements') {

    for (const tpl of ctx.templates) {

      if (tpl.required && !ctx.measurements[tpl.measurementKey]?.trim()) {

        return `Required measurement: ${tpl.labelEn}`;

      }

    }

  }

  if (step === 'aiAnalysis') {

    if (!ctx.issues.length) return 'Wait for AI analysis to complete.';

    for (const issue of ctx.issues) {

      if (!issue.aiCaseId) return 'Wait for AI analysis to complete.';

      if (!issue.finalDiagnosis?.trim()) {

        return 'Select a primary hypothesis or enter a manual diagnosis.';

      }

    }

  }

  if (step === 'agronomistReview') {

    return validateAgronomistReview(ctx.issues);

  }

  if (step === 'followUp') {

    for (const issue of ctx.issues) {

      if (!shouldRunFollowUp(issue)) continue;

      const qs = issue.followUpQuestions ?? [];

      if (qs.length && qs.some((q) => !q.answer?.trim())) {

        return 'Answer all follow-up questions, skip Q&A, or save answers and update diagnosis.';

      }

    }

  }

  if (step === 'additionalPhotos') {

    for (const issue of ctx.issues) {

      for (const req of issue.photoRequests ?? []) {

        const has = (issue.photos ?? []).some((p) => p.photoType === req.photoType);

        if (!has) return `Capture requested photo: ${req.label}`;

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

        if (!m.technicalName.trim()) return 'Each material needs a name.';

        if (!m.doseQuantity?.trim()) return 'Enter dose quantity for each material.';

        if (!m.doseUnit) return 'Select qty unit (KG, LTR, or ML).';

        if (!m.doseBasis) return 'Select dose basis (per 200 ltr water or per acre).';

        if (!m.applicationMode) return 'Select application mode.';

      }

    }

  }

  if (step === 'applicationSchedule') {

    const groups = ctx.recommendationGroups ?? [];

    if (!groups.length) return 'Complete recommendation planning first.';

  }

  if (step === 'recApproval') {

    if (ctx.partnerMode) return null;

    if (!ctx.recApproved) return 'Approve recommendations on the Rec OK step before continuing.';

    if (!(ctx.recommendationGroups ?? []).length) {

      return 'Complete recommendation planning before approval.';

    }

  }

  if (step === 'monitoringPlan') {

    if (!(ctx.monitoringPlan?.length ?? 0) && !(ctx.recommendationGroups ?? []).length) {

      return 'Generate a monitoring plan before continuing.';

    }

  }

  if (step === 'whatsappPreview') {

    if (!ctx.whatsappConfirmed && !ctx.partnerMode) {

      return 'Confirm the WhatsApp preview before continuing.';

    }

    if (!ctx.partnerMode) {
      const msgs = ctx.whatsappMessages ?? [];
      if (!msgs.length) return 'Generate WhatsApp messages before continuing.';
      for (const msg of msgs) {
        if (!msg.message.trim()) return 'Each WhatsApp message must have text before continuing.';
      }
    }

  }

  if (step === 'caseClosure') {

    const err = validateAgronomistReview(ctx.issues);

    if (err) return err;

  }

  return null;

}



/** Map legacy draft step ids to current wizard steps. */

export function normalizeVisitWizardStep(step: string): VisitWizardStep {

  if (step === 'recommendation') return 'recPlanning';

  if (step === 'issues') return 'agronomistReview';

  if (step === 'review') return 'agronomistReview';

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

  monitoringPlan?: MonitoringPlanPreviewItem[];

  savedAt: string;

};



export const VISIT_DRAFT_PREFIX = 'agronomist_visit_draft_';


