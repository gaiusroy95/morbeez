import type { VisitAssistantMessage, VisitAssistantProposalResponse } from '../visit-assistant/v1.js';

export const VISIT_COPILOT_CONTRACT_VERSION = 'visit-copilot/v1' as const;

export type VisitCopilotPhase =
  | 'idle'
  | 'awaiting_send_questions'
  | 'awaiting_farmer_evidence'
  | 'awaiting_approval'
  | 'approved';

export type VisitCopilotEvidenceItem = {
  label: string;
  status: 'pending' | 'received' | 'not_observed';
};

export type VisitCopilotStructuredPreview = {
  workingDiagnosis: string;
  diagnosisStatus: 'pending_confirmation' | 'suspected' | 'confirmed';
  confidence: number | null;
  evidenceRequired: VisitCopilotEvidenceItem[];
  evidenceReceived: Array<{ label: string; present: boolean }>;
};

export type VisitCopilotTreatmentActivity = {
  method: string;
  product: string;
  dose: string;
  intervalDays?: number | null;
  repeatCount?: number | null;
  notes?: string | null;
};

export type VisitCopilotTreatmentDraft = {
  activities: VisitCopilotTreatmentActivity[];
  farmerAdvice: string[];
  weatherAdvisory: string[];
};

export type VisitCopilotReminder = {
  dayOffset: number;
  label: string;
};

export type VisitCopilotValidationItem = {
  text: string;
  status: 'ok' | 'warning';
};

export type VisitCopilotValidation = {
  compatibility: VisitCopilotValidationItem[];
  weather: VisitCopilotValidationItem[];
  followUp: VisitCopilotValidationItem[];
};

export type VisitCopilotWorkflowState = {
  contractVersion: typeof VISIT_COPILOT_CONTRACT_VERSION;
  phase: VisitCopilotPhase;
  preview: VisitCopilotStructuredPreview;
  farmerQuestions: string[];
  farmerQuestionsSent: boolean;
  treatment: VisitCopilotTreatmentDraft | null;
  reminders: VisitCopilotReminder[];
  validation: VisitCopilotValidation | null;
  approvedAt: string | null;
};

export type VisitCopilotChatResponse = {
  assistantMessages: VisitAssistantMessage[];
  proposal: VisitAssistantProposalResponse;
  workflow: VisitCopilotWorkflowState;
};

export function emptyVisitCopilotWorkflow(): VisitCopilotWorkflowState {
  return {
    contractVersion: VISIT_COPILOT_CONTRACT_VERSION,
    phase: 'idle',
    preview: {
      workingDiagnosis: '',
      diagnosisStatus: 'pending_confirmation',
      confidence: null,
      evidenceRequired: [],
      evidenceReceived: [],
    },
    farmerQuestions: [],
    farmerQuestionsSent: false,
    treatment: null,
    reminders: [],
    validation: null,
    approvedAt: null,
  };
}
