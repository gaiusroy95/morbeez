/** Wizard schema version for server drafts. */
export const VISIT_WIZARD_VERSION = 'v12' as const;

export type VisitWizardStepV12 =
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

/** v12 screen flow (12 steps). */
export const V12_WIZARD_STEPS: VisitWizardStepV12[] = [
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

export const V12_WIZARD_STEP_LABELS: Array<{ id: VisitWizardStepV12; label: string }> = [
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

/** Maps legacy (pre-v12) step ids to v12 step ids. */
export const LEGACY_STEP_TO_V12: Record<string, VisitWizardStepV12> = {
  overview: 'intakeTriage',
  aiTriage: 'intakeTriage',
  followUp: 'dynamicQA',
  aiAnalysis: 'aiDiagnosis',
  agronomistReview: 'diagnosisFinalization',
  finalDiagnosis: 'diagnosisFinalization',
  issues: 'diagnosisFinalization',
  review: 'diagnosisFinalization',
  additionalPhotos: 'photos',
  economicOptimizer: 'recommendationBuilder',
  recPlanning: 'recommendationBuilder',
  recommendation: 'recommendationBuilder',
  applicationSchedule: 'scheduleCompatibility',
  recApproval: 'scheduleCompatibility',
  whatsappPreview: 'farmerCommunication',
  summary: 'visitSummary',
  monitoringPlan: 'followUpPlanning',
  caseClosure: 'learningSubmit',
  measurements: 'fieldIntelligence',
  soilWeather: 'fieldIntelligence',
};

export function mapLegacyStepToV12(step: string): VisitWizardStepV12 | null {
  if ((V12_WIZARD_STEPS as string[]).includes(step)) return step as VisitWizardStepV12;
  return LEGACY_STEP_TO_V12[step] ?? null;
}
