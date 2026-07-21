export type ExpertCaseReviewEventType =
  | 'diagnosis'
  | 'hypothesis'
  | 'severity'
  | 'evidence'
  | 'treatment'
  | 'follow_up'
  | 'recovery'
  | 'knowledge_candidate'
  | 'closure'
  | 'validation'
  | 'farmer_question'
  | 'image_analysis';

export type ExpertCompatibilityRow = {
  product: string;
  status: 'pass' | 'fail' | 'separate' | 'unknown';
  note?: string | null;
};

export type ExpertTreatmentActivity = {
  method?: string | null;
  product?: string | null;
  dose?: string | null;
  dilutionVolumeL?: number | null;
  dilutionNotes?: string | null;
  interval?: string | null;
  notes?: string | null;
};

export type ExpertCaseValidations = {
  compatibility?: ExpertCompatibilityRow[];
  weather?: {
    forecast?: string | null;
    recommendation?: string | null;
    wind?: string | null;
    humidity?: string | null;
    status?: string | null;
  } | null;
  dosage?: {
    status?: string | null;
    message?: string | null;
    labelDoseApplied?: boolean | null;
    askLabelDose?: boolean | null;
    askDilution?: boolean | null;
    dilutionMessage?: string | null;
  } | null;
  frac?: {
    previousSpray?: string | null;
    daysAgo?: number | null;
    rotationOk?: boolean | null;
    risk?: string | null;
  } | null;
  phytotoxicity?: {
    risk?: string | null;
  } | null;
  safety?: {
    ppe?: boolean | null;
    reiHours?: number | null;
    phiRecorded?: boolean | null;
  } | null;
  summary?: string[];
};

export type ExpertCaseReviewDraft = {
  diagnosis?: string | null;
  confidence?: number | null;
  severity?: string | null;
  secondaryDiagnosis?: string | null;
  secondaryConfidence?: number | null;
  recommendationText?: string | null;
  dosage?: string | null;
  dosageSource?: 'label' | 'manual' | 'pending' | null;
  applicationMethod?: string | null;
  applicationTiming?: string | null;
  treatmentProduct?: string | null;
  evidence?: string[];
  rootCauses?: string[];
  nutritionProduct?: string | null;
  nutritionDose?: string | null;
  nutritionTiming?: string | null;
  culturalPractices?: string[];
  precautions?: string[];
  farmerTasks?: string[];
  followUpDays?: number | null;
  recoveryStatus?: string | null;
  knowledgeCandidate?: boolean;
  knowledgeCandidateReason?: string | null;
  notes?: string | null;
  unresolvedFields?: string[];
  farmerQuestions?: string[];
  farmerQuestionsSent?: boolean;
  farmerAnswers?: Record<string, string> | null;
  treatmentActivities?: ExpertTreatmentActivity[];
  sprayVolumeL?: number | null;
  dilutionNotes?: string | null;
  imageAnalysis?: {
    findings?: string[];
    annotated?: boolean;
    offerAnnotate?: boolean;
    images?: Array<{ url: string; label?: string }>;
    imagesOpened?: boolean;
  } | null;
  validations?: ExpertCaseValidations | null;
};

export type ExpertCaseReviewProposal = {
  assistantMessage: string;
  clarification: string | null;
  draft: ExpertCaseReviewDraft;
  events?: Array<{ type: ExpertCaseReviewEventType; payload: Record<string, unknown> }>;
};

export type ExpertCaseBriefing = {
  caseCode?: string | null;
  farmerName?: string | null;
  cropType?: string | null;
  growthStage?: string | null;
  imageCount?: number;
  images?: Array<{ url: string; label?: string }>;
  weather?: {
    rainfall7dMm?: number | null;
    humidityPct?: number | null;
    temperatureC?: number | null;
    summary?: string | null;
  } | null;
  soil?: {
    ph?: string | null;
    ec?: string | null;
    status?: string | null;
  } | null;
  previousActivities?: string[];
  primaryDiagnosis?: string | null;
  primaryConfidence?: number | null;
  alternativeDiagnosis?: string | null;
  alternativeConfidence?: number | null;
  confidenceBand?: string | null;
};

/** Empty draft used when a case opens or extraction falls back. */
export function emptyExpertCaseDraft(): ExpertCaseReviewDraft {
  return {
    diagnosis: null,
    confidence: null,
    severity: null,
    secondaryDiagnosis: null,
    secondaryConfidence: null,
    recommendationText: null,
    dosage: null,
    dosageSource: null,
    applicationMethod: null,
    applicationTiming: null,
    treatmentProduct: null,
    evidence: [],
    rootCauses: [],
    nutritionProduct: null,
    nutritionDose: null,
    nutritionTiming: null,
    culturalPractices: [],
    precautions: [],
    farmerTasks: [],
    followUpDays: null,
    recoveryStatus: null,
    knowledgeCandidate: false,
    knowledgeCandidateReason: null,
    notes: null,
    unresolvedFields: [],
    farmerQuestions: [],
    farmerQuestionsSent: false,
    farmerAnswers: null,
    treatmentActivities: [],
    sprayVolumeL: null,
    dilutionNotes: null,
    imageAnalysis: null,
    validations: null,
  };
}

export function mergeExpertCaseDraft(
  base: ExpertCaseReviewDraft | null | undefined,
  patch: ExpertCaseReviewDraft
): ExpertCaseReviewDraft {
  const merged: ExpertCaseReviewDraft = { ...(base ?? emptyExpertCaseDraft()) };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'unresolvedFields' || key === 'validations') continue;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (merged as Record<string, unknown>)[key] = value;
  }
  if (patch.validations) {
    merged.validations = {
      ...(merged.validations ?? {}),
      ...patch.validations,
      compatibility: patch.validations.compatibility ?? merged.validations?.compatibility,
      summary: patch.validations.summary ?? merged.validations?.summary,
    };
  }
  const unresolved = [...new Set(patch.unresolvedFields ?? merged.unresolvedFields ?? [])];
  merged.unresolvedFields = unresolved;
  return merged;
}

export function draftHasTreatment(draft: ExpertCaseReviewDraft | null | undefined): boolean {
  if (!draft) return false;
  if ((draft.treatmentActivities?.length ?? 0) > 0) return true;
  return Boolean(
    String(draft.treatmentProduct ?? '').trim() ||
      String(draft.recommendationText ?? '').trim() ||
      String(draft.dosage ?? '').trim()
  );
}

export function draftNeedsDilutionClarification(
  draft: ExpertCaseReviewDraft | null | undefined
): boolean {
  if (!draft || !draftHasTreatment(draft)) return false;
  const foliar = (draft.treatmentActivities ?? []).filter((row) =>
    /spray|foliar/i.test(String(row.method ?? ''))
  );
  if (foliar.length) {
    return foliar.some(
      (row) => Boolean(String(row.product ?? row.dose ?? '').trim()) && row.dilutionVolumeL == null
    );
  }
  if (!/spray|foliar/i.test(String(draft.applicationMethod ?? ''))) return false;
  if (draft.sprayVolumeL != null) return false;
  const dilutionText = [draft.dosage, draft.dilutionNotes, draft.recommendationText]
    .filter(Boolean)
    .join(' ');
  return !/\b\d+(?:\.\d+)?\s*(?:l|liter|litre|ltr)\b/i.test(dilutionText);
}

export function draftValidationChecklist(draft: ExpertCaseReviewDraft | null | undefined): string[] {
  const v = draft?.validations;
  const items: string[] = [];
  if (draft?.diagnosis) items.push('Diagnosis Complete');
  if ((draft?.evidence?.length ?? 0) > 0) items.push('Evidence Verified');
  if (draftHasTreatment(draft)) items.push('Treatment Generated');
  if (v?.compatibility?.length) items.push('Compatibility Passed');
  if (v?.weather) items.push('Weather Checked');
  if (v?.dosage && !v.dosage.askLabelDose && !v.dosage.askDilution) items.push('Dosage Validated');
  if (v?.frac) items.push('FRAC Rotation Checked');
  if (v?.phytotoxicity) items.push('Phytotoxicity Low');
  if (v?.safety) items.push('Safety Passed');
  if (draft?.farmerQuestionsSent && draft.farmerAnswers) items.push('Farmer Questions Completed');
  if (draft?.followUpDays != null) items.push('Reminder Scheduled');
  return v?.summary?.length ? v.summary : items;
}
