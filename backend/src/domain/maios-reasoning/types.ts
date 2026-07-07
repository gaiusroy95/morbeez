/** MAIOS v17 reasoning layer — composes existing MAIOS v12 case data (does not replace it). */

export type ReasoningEvidenceSource =
  | 'context'
  | 'weather'
  | 'regional'
  | 'vision'
  | 'farmer'
  | 'soil'
  | 'lab'
  | 'photo';

export type ReasoningEvidenceItem = {
  key: string;
  label: string;
  source: ReasoningEvidenceSource;
  reliability: number;
  value?: string;
};

export type LikelihoodRatioRule = {
  evidenceKey: string;
  diseaseLabel: string;
  lr: number;
};

export type ReasoningQuestion = {
  id: string;
  text: string;
  answerType: 'yes_no' | 'text';
  evidenceKeyIfYes: string;
  evidenceKeyIfNo?: string;
};

export type CropKnowledgePackage = {
  cropType: string;
  version: string;
  diseaseLabels: string[];
  likelihoodRatios: LikelihoodRatioRule[];
  questions: ReasoningQuestion[];
  defaultPriorWeight: Record<string, number>;
  managementRules?: import('./management-types.js').DiseaseManagementRule[];
  safetyRules?: import('./management-types.js').SafetyRule[];
};

export type PosteriorEntry = {
  label: string;
  probability: number;
};

export type EvsiCandidate = {
  kind: 'question' | 'photo_slot' | 'lab';
  id: string;
  label: string;
  expectedInformationGain: number;
};

export type ReasoningDecision = {
  action: 'LOCK' | 'CONTINUE';
  topLabel: string | null;
  topConfidence: number;
  threshold: number;
  evidenceCount: number;
  reviewRequired: boolean;
  reason: string;
};

export type ReasoningExplanation = {
  diagnosis: string | null;
  confidence: number;
  supporting: string[];
  rejected: string[];
  missing: string[];
};

export type MaiosReasoningSnapshot = {
  pipelineVersion: '17.0';
  knowledgeVersion: string;
  evidence: ReasoningEvidenceItem[];
  prior: PosteriorEntry[];
  posterior: PosteriorEntry[];
  decision: ReasoningDecision;
  explanation: ReasoningExplanation;
  nextEvidence: EvsiCandidate | null;
  management: import('./management-types.js').ScientificManagementPlan | null;
  safety: import('./management-types.js').SafetyValidationResult | null;
  finalReport: import('./management-types.js').DiagnosisFinalReport | null;
  shadowMode: boolean;
};
