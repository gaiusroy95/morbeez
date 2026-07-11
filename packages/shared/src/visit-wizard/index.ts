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

export {
  buildAnalyzeVisitBody,
  issuesNeedInitialScreening,
  withTimeout,
} from './visit-screening';
export { expandSeparateNutrientIssues, shouldSplitNutrientIssue } from './visit-issue-split';
export {
  defaultComplianceQuestion,
  resolveComplianceQuestion,
  stripComplianceReplyHint,
  type WhatsappComplianceNoAction,
} from './whatsapp-compliance';

export type { VisitScreeningParams, VisitScreeningPhoto } from './visit-screening';

import { mapLegacyStepToV12 } from './step-map';
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
  blockAutoApprove,
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
  blockAutoApprove,
} from './step-flow';
export type { TriagePreview, MaiosTriageLevel } from './step-flow';

export {
  VISIT_WIZARD_VERSION,
  V12_WIZARD_STEPS,
  LEGACY_STEP_TO_V12,
  mapLegacyStepToV12,
} from './step-map';
export type { VisitWizardStepV12 } from './step-map';

export {
  formatConfidenceProgress,
  confidenceThresholdMessage,
  distributionForDisplay,
  CONFIDENCE_TARGET_PERCENT,
} from './confidence-ui';
export type { ConfidenceDistributionView } from './confidence-ui';

export { buildDraftPayload, scheduleServerDraftSync, flushServerDraftSync } from './draft-sync';
export type { DraftSyncClient } from './draft-sync';

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

import type {
  RecommendationGroupDraft,
  RecommendationGroupMaterialDraft,
} from './recommendation-material';

export type { DoseBasis, DoseUnit, MaterialApplicationMode, RecommendationGroupDraft, RecommendationGroupMaterialDraft } from './recommendation-material';

export { buildPriorRecommendationFollowUps } from './prior-recommendation-followups';
export { protocolToRecommendationGroups } from './protocol-load';

export type {
  PriorRecommendationFollowUpDraft,
  PriorRecommendationFollowUpSource,
} from './prior-recommendation-followups';



export type VisitWizardStep =
  | 'intakeTriage'
  | 'photos'
  | 'fieldIntelligence'
  | 'dynamicQA'
  | 'aiDiagnosis'
  | 'diagnosisFinalization'
  | 'recommendationBuilder'
  | 'scheduleCompatibility'
  | 'farmerCommunication'
  | 'visitSummary'
  | 'followUpPlanning'
  | 'learningSubmit';

export const VISIT_WIZARD_STEPS: Array<{ id: VisitWizardStep; label: string }> = [
  { id: 'intakeTriage', label: 'Intake' },
  { id: 'photos', label: 'Photos' },
  { id: 'fieldIntelligence', label: 'Field intel' },
  { id: 'dynamicQA', label: 'Q&A' },
  { id: 'aiDiagnosis', label: 'AI Dx' },
  { id: 'diagnosisFinalization', label: 'Validate' },
  { id: 'recommendationBuilder', label: 'Rec plan' },
  { id: 'scheduleCompatibility', label: 'Schedule' },
  { id: 'farmerCommunication', label: 'WhatsApp' },
  { id: 'visitSummary', label: 'Summary' },
  { id: 'followUpPlanning', label: 'Follow-up' },
  { id: 'learningSubmit', label: 'Submit' },
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

  /** @deprecated Use complianceQuestion */
  compliancePrompt?: string;

  complianceQuestion?: string;

  /** When farmer taps No on WhatsApp — escalate to agronomist or telecaller review */
  complianceNoAction?: import('./whatsapp-compliance.js').WhatsappComplianceNoAction;

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



export type VisitWeatherDaily = {
  date: string;
  temperatureC: number | null;
  humidityPct: number | null;
  rainfallMm: number | null;
};

export type VisitWeatherPressures = {
  heatStress: boolean;
  waterlogging: boolean;
  fungalPressure: boolean;
  pestPressure: boolean;
  irrigationTrend: string;
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

    last7Days?: VisitWeatherDaily[];

    totals7d?: {

      rainfallMm: number;

      avgTempC: number;

      avgHumidityPct: number;

    } | null;

    pressures?: VisitWeatherPressures | null;

  };

};



export type VisitPhotoValidationIssue = 'blur' | 'dark' | 'low_resolution' | 'coverage';



export type VisitPhotoValidationResult = {

  ok: boolean;

  issues: VisitPhotoValidationIssue[];

  retakeRecommended: boolean;

};



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
    options?: string[];
    priority?: number;
    imageTarget?: string;
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

  triage?: import('./step-flow.js').TriagePreview | null;
  selectedRecommendationOptionId?: string | null;
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



function validateAgronomistReview(
  issues: VisitIssueDraft[],
  triage?: import('./step-flow.js').TriagePreview | null
): string | null {

  if (!issues.length) return 'Add at least one issue.';

  const l4Blocked = blockAutoApprove({ triage, issues });

  for (const issue of issues) {

    if (!issue.issueName.trim()) return 'Each issue needs a name.';

    if (!issue.agronomistReview?.action) return 'Record a review decision for each issue.';

    const action = issue.agronomistReview.action;

    if (l4Blocked && action === 'approve_ai') {
      return 'L4 critical cases cannot auto-approve AI — modify, partial match, or escalate.';
    }

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

  if (step === 'intakeTriage') {
    if (!ctx.blockHealth || !ctx.cropPerformance || !ctx.soilMoisture) {
      return 'Select block health, crop performance, and soil moisture on the Intake step.';
    }
    if (!ctx.triage) return 'Run triage preview before continuing.';
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

  if (step === 'fieldIntelligence') {
    for (const tpl of ctx.templates) {
      if (tpl.required && !ctx.measurements[tpl.measurementKey]?.trim()) {
        return `Required measurement: ${tpl.labelEn}`;
      }
    }
  }

  if (step === 'dynamicQA') {
    if (!ctx.issues.length || !ctx.issues.some((i) => i.aiCaseId)) {
      return 'Wait for initial AI screening to finish before Q&A.';
    }
    for (const issue of ctx.issues) {
      if (!shouldRunFollowUp(issue, { issues: ctx.issues, triage: ctx.triage, partnerMode: ctx.partnerMode })) continue;
      const qs = issue.followUpQuestions ?? [];
      if (qs.length && qs.some((q) => !q.answer?.trim())) {
        return 'Answer follow-up questions, skip Q&A, or finalize when confidence threshold is reached.';
      }
    }
  }

  if (step === 'aiDiagnosis') {
    if (!ctx.issues.length) return 'Complete Q&A screening before AI diagnosis.';
    for (const issue of ctx.issues) {
      if (!issue.aiCaseId) return 'Wait for AI screening to complete.';
      if (!issue.finalDiagnosis?.trim()) return 'AI diagnosis is required before validation.';
    }
  }

  if (step === 'diagnosisFinalization') {
    for (const issue of ctx.issues) {
      if (!issue.finalDiagnosis?.trim()) return 'Each issue needs a final diagnosis before continuing.';
    }
    return validateAgronomistReview(ctx.issues, ctx.triage);
  }

  if (step === 'recommendationBuilder') {

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

  if (step === 'scheduleCompatibility') {
    const groups = ctx.recommendationGroups ?? [];
    if (!groups.length) return 'Complete recommendation planning first.';
    if (!ctx.partnerMode && !ctx.recApproved) {
      return 'Approve recommendations and confirm compatibility before continuing.';
    }
  }

  if (step === 'followUpPlanning') {
    if (!(ctx.monitoringPlan?.length ?? 0) && !(ctx.recommendationGroups ?? []).length) {
      return 'Set a follow-up or monitoring plan before continuing.';
    }
  }

  if (step === 'farmerCommunication') {

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

  if (step === 'learningSubmit') {
    const err = validateAgronomistReview(ctx.issues);
    if (err) return err;
  }

  return null;

}



/** Map legacy draft step ids to v12 wizard steps. */
export function normalizeVisitWizardStep(step: string): VisitWizardStep {
  const mapped = mapLegacyStepToV12(step);
  if (mapped) return mapped;
  return 'intakeTriage';
}



export type VisitDraftPayload = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  currentStep?: VisitWizardStep;
  wizardVersion?: string;
  blockHealth?: BlockHealthLevel;
  cropPerformance?: CropPerformanceLevel;
  soilMoisture?: SoilMoistureLevel;
  visitClassification?: string;
  selectedCategories?: IssueCategory[];
  issues?: StructuredVisitIssueInput[];
  measurements?: Record<string, string>;
  fieldVoiceNote?: string;
  recommendationGroups?: RecommendationGroupDraft[];
  monitoringPlan?: MonitoringPlanPreviewItem[];
  triage?: import('./step-flow.js').TriagePreview | null;
  confidenceThresholdReached?: boolean;
  savedAt: string;
};



export const VISIT_DRAFT_PREFIX = 'agronomist_visit_draft_';


