import type {
  BlockHealthLevel,
  CropPerformanceLevel,
  IssueCategory,
  IssueStatus,
  RecommendationFollowed,
  RecordSeverity,
  SoilMoistureLevel,
  VisitClassification,
  VisitFollowupOutcome,
} from '../types/field-findings.js';
import type {
  DoseBasis,
  DoseUnit,
  MaterialApplicationMode,
} from '../visit-wizard/recommendation-material.js';

export const VISIT_ASSISTANT_CONTRACT_VERSION = 'visit-assistant/v1' as const;

export type VisitAssistantContractVersion = typeof VISIT_ASSISTANT_CONTRACT_VERSION;
export type VisitAssistantConfidence = 'low' | 'medium' | 'high';
export type VisitAssistantProvenance =
  | 'assistant_inference'
  | 'agronomist_message'
  | 'draft'
  | 'field_observation'
  | 'farmer_history'
  | 'measurement'
  | 'soil_report'
  | 'weather';

export type VisitAssistantEvidence =
  | { kind: 'message'; messageId: string; excerpt?: string }
  | { kind: 'measurement'; key: string; excerpt?: string }
  | { kind: 'field_note'; excerpt: string }
  | { kind: 'issue'; issueRef: string; excerpt?: string }
  | { kind: 'photo'; photoRef: string; excerpt?: string }
  | { kind: 'farmer_history'; recordRef: string; excerpt?: string }
  | { kind: 'soil_report'; recordRef: string; excerpt?: string }
  | { kind: 'weather'; observedAt: string; excerpt?: string };

/** Metadata travels with every proposed field instead of being hidden in prose. */
export type VisitAssistantFieldProposal<T> = {
  value: T;
  confidence: VisitAssistantConfidence;
  provenance: VisitAssistantProvenance;
  evidence: VisitAssistantEvidence[];
};

export type VisitAssistantStoredField<T> = VisitAssistantFieldProposal<T> & {
  updatedAtRevision: number;
};

export type VisitAssistantMessage = {
  id: string;
  role: 'agronomist' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

/** Read-only visit context; no operation can rewrite historical records. */
export type VisitAssistantHistoryItem = {
  ref: string;
  kind: 'prior_visit' | 'prior_recommendation' | 'farmer_note' | 'application';
  summary: string;
  occurredAt: string;
};

export type VisitAssistantIssue = {
  ref: string;
  category: VisitAssistantStoredField<IssueCategory>;
  issueName: VisitAssistantStoredField<string>;
  severity: VisitAssistantStoredField<RecordSeverity>;
  observation?: VisitAssistantStoredField<string>;
  status?: VisitAssistantStoredField<IssueStatus>;
  finalDiagnosis?: VisitAssistantStoredField<string>;
};

export type VisitAssistantRecommendationMaterial = {
  ref: string;
  issueRef: string;
  category: VisitAssistantStoredField<string>;
  technicalName: VisitAssistantStoredField<string>;
  doseQuantity?: VisitAssistantStoredField<string>;
  doseUnit?: VisitAssistantStoredField<DoseUnit>;
  doseBasis?: VisitAssistantStoredField<DoseBasis>;
  applicationMode?: VisitAssistantStoredField<MaterialApplicationMode>;
};

export type VisitAssistantRecommendationGroup = {
  ref: string;
  applicationType: VisitAssistantStoredField<string>;
  applicationDay: VisitAssistantStoredField<number>;
  materials: VisitAssistantRecommendationMaterial[];
};

export type VisitAssistantMonitoringItem = {
  ref: string;
  issueRef: string;
  intervalDays: VisitAssistantStoredField<number>;
  checkType: VisitAssistantStoredField<string>;
  severity: VisitAssistantStoredField<RecordSeverity>;
};

export type VisitAssistantFollowUp = {
  recommendationRef: string;
  followed: VisitAssistantStoredField<RecommendationFollowed>;
  outcome: VisitAssistantStoredField<VisitFollowupOutcome>;
  notes?: VisitAssistantStoredField<string>;
};

export type VisitAssistantSafetyConfirmation = {
  confirmedRevision: number;
  confirmedAt: string;
  confirmedBy: string;
};

export type VisitAssistantRecommendationValidationMaterial = {
  localId: string;
  issueLocalId?: string;
  category?: string;
  technicalName?: string;
  doseQuantity?: string;
  doseUnit?: DoseUnit;
  doseBasis?: DoseBasis;
  applicationMode?: MaterialApplicationMode;
};

export type VisitAssistantRecommendationValidationGroup = {
  localId: string;
  applicationType?: string;
  applicationDay?: number;
  materials: VisitAssistantRecommendationValidationMaterial[];
};

export type VisitAssistantRecommendationValidationRequest = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  recommendationGroups: VisitAssistantRecommendationValidationGroup[];
  cropType?: string;
  dap?: number | null;
  stage?: string | null;
  weather?: {
    heavyRainLikely?: boolean;
    highHeatLikely?: boolean;
  };
};

export type VisitAssistantRecommendationValidationIssue = {
  code: string;
  message: string;
  groupRef?: string;
  materialRef?: string;
  field?: 'technicalName' | 'doseQuantity' | 'doseUnit' | 'doseBasis' | 'applicationMode';
};

export type VisitAssistantRecommendationCompatibilityReport = {
  groups: Array<{
    groupRef: string;
    pairs: Array<{
      productA: string;
      productB: string;
      found: boolean;
      compatible?: boolean;
      minIntervalHours?: number | null;
      notes?: string | null;
    }>;
    hasIncompatiblePair: boolean;
    hasUnknownPair: boolean;
  }>;
  hasIncompatiblePair: boolean;
  hasUnknownPair: boolean;
};

export type VisitAssistantRecommendationSafetyReport = {
  status: 'PASS' | 'REJECT' | 'UNRESOLVED';
  checks: Array<{ ruleId: string; passed: boolean; reason: string }>;
  rejectReasons: string[];
  context: {
    cropType?: string;
    dap?: number | null;
    stage?: string | null;
    weather?: {
      heavyRainLikely?: boolean;
      highHeatLikely?: boolean;
    };
  };
};

/** Validation is advisory gating only; it never approves or submits a visit. */
export type VisitAssistantRecommendationValidationResult = {
  ok: boolean;
  blockers: VisitAssistantRecommendationValidationIssue[];
  warnings: VisitAssistantRecommendationValidationIssue[];
  unresolvedFields: VisitAssistantRecommendationValidationIssue[];
  compatibilityReport: VisitAssistantRecommendationCompatibilityReport;
  safetyReport: VisitAssistantRecommendationSafetyReport | null;
};

/**
 * A deliberately reduced visit view. Omitted identity, photo/GPS, review,
 * approval, compatibility, communication and submission fields cannot be
 * changed through this contract.
 */
export type VisitAssistantSnapshot = {
  contractVersion: VisitAssistantContractVersion;
  revision: number;
  messages: VisitAssistantMessage[];
  history: VisitAssistantHistoryItem[];
  draft: {
    assessments: {
      blockHealth?: VisitAssistantStoredField<BlockHealthLevel>;
      cropPerformance?: VisitAssistantStoredField<CropPerformanceLevel>;
      soilMoisture?: VisitAssistantStoredField<SoilMoistureLevel>;
    };
    classification?: VisitAssistantStoredField<VisitClassification>;
    measurements: Record<string, VisitAssistantStoredField<string>>;
    fieldNote?: VisitAssistantStoredField<string>;
    issues: VisitAssistantIssue[];
    recommendationGroups: VisitAssistantRecommendationGroup[];
    monitoring: VisitAssistantMonitoringItem[];
    followUps: VisitAssistantFollowUp[];
    safetyConfirmation: VisitAssistantSafetyConfirmation | null;
  };
};

export type VisitAssistantAssessmentOperation = {
  id: string;
  kind: 'assessment.set';
  field: 'blockHealth' | 'cropPerformance' | 'soilMoisture';
  proposed: VisitAssistantFieldProposal<BlockHealthLevel | CropPerformanceLevel | SoilMoistureLevel>;
};

export type VisitAssistantClassificationOperation = {
  id: string;
  kind: 'classification.set';
  proposed: VisitAssistantFieldProposal<VisitClassification>;
};

export type VisitAssistantMeasurementOperation = {
  id: string;
  kind: 'measurement.set';
  key: string;
  proposed: VisitAssistantFieldProposal<string>;
};

export type VisitAssistantFieldNoteOperation = {
  id: string;
  kind: 'field_note.set' | 'field_note.append';
  proposed: VisitAssistantFieldProposal<string>;
};

export type VisitAssistantIssueAddOperation = {
  id: string;
  kind: 'issue.add';
  issue: {
    category: VisitAssistantFieldProposal<IssueCategory>;
    issueName: VisitAssistantFieldProposal<string>;
    severity: VisitAssistantFieldProposal<RecordSeverity>;
    observation?: VisitAssistantFieldProposal<string>;
    status?: VisitAssistantFieldProposal<IssueStatus>;
    finalDiagnosis?: VisitAssistantFieldProposal<string>;
  };
};

export type VisitAssistantIssueUpdateOperation = {
  id: string;
  kind: 'issue.update';
  issueRef: string;
  changes: {
    category?: VisitAssistantFieldProposal<IssueCategory>;
    issueName?: VisitAssistantFieldProposal<string>;
    severity?: VisitAssistantFieldProposal<RecordSeverity>;
    observation?: VisitAssistantFieldProposal<string>;
    status?: VisitAssistantFieldProposal<IssueStatus>;
    finalDiagnosis?: VisitAssistantFieldProposal<string>;
  };
};

export type VisitAssistantRecommendationGroupAddOperation = {
  id: string;
  kind: 'recommendation.group.add';
  group: {
    applicationType: VisitAssistantFieldProposal<string>;
    applicationDay: VisitAssistantFieldProposal<number>;
  };
};

export type VisitAssistantRecommendationGroupUpdateOperation = {
  id: string;
  kind: 'recommendation.group.update';
  groupRef: string;
  changes: {
    applicationType?: VisitAssistantFieldProposal<string>;
    applicationDay?: VisitAssistantFieldProposal<number>;
  };
};

export type VisitAssistantRecommendationMaterialAddOperation = {
  id: string;
  kind: 'recommendation.material.add';
  groupRef: string;
  material: {
    issueRef: string;
    category: VisitAssistantFieldProposal<string>;
    technicalName: VisitAssistantFieldProposal<string>;
    doseQuantity?: VisitAssistantFieldProposal<string>;
    doseUnit?: VisitAssistantFieldProposal<DoseUnit>;
    doseBasis?: VisitAssistantFieldProposal<DoseBasis>;
    applicationMode?: VisitAssistantFieldProposal<MaterialApplicationMode>;
  };
};

export type VisitAssistantRecommendationMaterialUpdateOperation = {
  id: string;
  kind: 'recommendation.material.update';
  groupRef: string;
  materialRef: string;
  changes: {
    category?: VisitAssistantFieldProposal<string>;
    technicalName?: VisitAssistantFieldProposal<string>;
    doseQuantity?: VisitAssistantFieldProposal<string>;
    doseUnit?: VisitAssistantFieldProposal<DoseUnit>;
    doseBasis?: VisitAssistantFieldProposal<DoseBasis>;
    applicationMode?: VisitAssistantFieldProposal<MaterialApplicationMode>;
  };
};

export type VisitAssistantMonitoringAddOperation = {
  id: string;
  kind: 'monitoring.add';
  item: {
    issueRef: string;
    intervalDays: VisitAssistantFieldProposal<number>;
    checkType: VisitAssistantFieldProposal<string>;
    severity: VisitAssistantFieldProposal<RecordSeverity>;
  };
};

export type VisitAssistantMonitoringUpdateOperation = {
  id: string;
  kind: 'monitoring.update';
  monitoringRef: string;
  changes: {
    intervalDays?: VisitAssistantFieldProposal<number>;
    checkType?: VisitAssistantFieldProposal<string>;
    severity?: VisitAssistantFieldProposal<RecordSeverity>;
  };
};

export type VisitAssistantFollowUpSetOperation = {
  id: string;
  kind: 'follow_up.set';
  recommendationRef: string;
  followUp: {
    followed: VisitAssistantFieldProposal<RecommendationFollowed>;
    outcome: VisitAssistantFieldProposal<VisitFollowupOutcome>;
    notes?: VisitAssistantFieldProposal<string>;
  };
};

/** Exhaustive allowlist: there is intentionally no generic path operation. */
export type VisitAssistantOperation =
  | VisitAssistantAssessmentOperation
  | VisitAssistantClassificationOperation
  | VisitAssistantMeasurementOperation
  | VisitAssistantFieldNoteOperation
  | VisitAssistantIssueAddOperation
  | VisitAssistantIssueUpdateOperation
  | VisitAssistantRecommendationGroupAddOperation
  | VisitAssistantRecommendationGroupUpdateOperation
  | VisitAssistantRecommendationMaterialAddOperation
  | VisitAssistantRecommendationMaterialUpdateOperation
  | VisitAssistantMonitoringAddOperation
  | VisitAssistantMonitoringUpdateOperation
  | VisitAssistantFollowUpSetOperation;

export type VisitAssistantFieldTarget =
  | { kind: 'assessment'; field: 'blockHealth' | 'cropPerformance' | 'soilMoisture' }
  | { kind: 'classification' }
  | { kind: 'measurement'; key: string }
  | { kind: 'field_note' }
  | { kind: 'issue'; issueRef?: string; field?: 'category' | 'issueName' | 'severity' | 'observation' | 'status' | 'finalDiagnosis' }
  | { kind: 'recommendation'; groupRef?: string; materialRef?: string }
  | { kind: 'monitoring'; monitoringRef?: string }
  | { kind: 'follow_up'; recommendationRef: string };

export type VisitAssistantClarification = {
  id: string;
  question: string;
  target: VisitAssistantFieldTarget;
  required: boolean;
};

export type VisitAssistantUnresolvedField = {
  target: VisitAssistantFieldTarget;
  reason: 'missing_information' | 'ambiguous' | 'conflicting_evidence' | 'requires_agronomist';
  detail: string;
};

export type VisitAssistantProposalResponse = {
  contractVersion: VisitAssistantContractVersion;
  proposalId: string;
  baseRevision: number;
  messages: VisitAssistantMessage[];
  operations: VisitAssistantOperation[];
  clarifications: VisitAssistantClarification[];
  unresolvedFields: VisitAssistantUnresolvedField[];
};

export type VisitAssistantProposalRisk = {
  level: 'standard' | 'critical';
  reasons: string[];
};

export type VisitAssistantApplyRequest = {
  acceptedOperationIds: string[];
  explicitCriticalConfirmation?: boolean;
};

export type VisitAssistantApplyError =
  | { code: 'invalid_proposal'; errors: string[] }
  | { code: 'stale_base_revision'; expectedRevision: number; actualRevision: number }
  | { code: 'conflict'; operationId?: string; detail: string }
  | { code: 'critical_confirmation_required'; operationIds: string[] };

export type VisitAssistantApplyResult =
  | {
      ok: true;
      snapshot: VisitAssistantSnapshot;
      appliedOperationIds: string[];
      safetyConfirmationInvalidated: boolean;
    }
  | { ok: false; error: VisitAssistantApplyError };

