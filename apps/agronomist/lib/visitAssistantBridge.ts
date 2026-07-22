import {
  VISIT_ASSISTANT_CONTRACT_VERSION,
  applyAcceptedVisitAssistantOperations,
  classifyVisitAssistantOperation,
  type VisitAssistantApplyRequest,
  type VisitAssistantApplyResult,
  type VisitAssistantHistoryItem,
  type VisitAssistantMessage,
  type VisitAssistantOperation,
  type VisitAssistantProposalResponse,
  type VisitAssistantRecommendationValidationResult,
  type VisitAssistantSafetyConfirmation,
  type VisitAssistantSnapshot,
  type VisitAssistantStoredField,
} from '@morbeez/shared/visit-assistant';
import type {
  BlockHealthLevel,
  CropPerformanceLevel,
  IssueCategory,
  IssueStatus,
  MonitoringPlanPreviewItem,
  RecommendationFollowed,
  RecommendationGroupDraft,
  SoilMoistureLevel,
  VisitClassification,
  VisitFollowupOutcome,
  VisitIssueDraft,
} from '@morbeez/shared';
import type { VisitCopilotWorkflowState } from '@morbeez/shared/visit-copilot';
import { emptyVisitCopilotWorkflow } from '@morbeez/shared/visit-copilot';

/** Wizard issue shape used by the bridge (keeps RN component imports out of unit tests). */
export type BridgeIssueDraft = VisitIssueDraft & {
  photosPreview?: unknown[];
  categoryLabel?: string;
};

export type BridgeFollowUpDraft = {
  recommendationId: string;
  label: string;
  followed: RecommendationFollowed;
  outcome: VisitFollowupOutcome;
  notes: string;
};

function newBridgeIssue(category: IssueCategory, localId: string): BridgeIssueDraft {
  return {
    localId,
    category,
    issueName: '',
    severity: 'medium',
    status: 'open',
    observation: '',
  };
}

export type VisitAssistantPersistedState = {
  revision: number;
  messages: VisitAssistantMessage[];
  history: VisitAssistantHistoryItem[];
  pendingProposal: VisitAssistantProposalResponse | null;
  rejectedOperationIds: string[];
  filledKeys: string[];
  safetyConfirmation: VisitAssistantSafetyConfirmation | null;
  recommendationValidation: VisitAssistantRecommendationValidationResult | null;
  workflow: VisitCopilotWorkflowState | null;
};

export type WizardAssistantSource = {
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  visitClassification: VisitClassification;
  measurements: Record<string, string>;
  fieldVoiceNote: string;
  issues: BridgeIssueDraft[];
  recommendationGroups: RecommendationGroupDraft[];
  monitoringPlan: MonitoringPlanPreviewItem[];
  followUps: BridgeFollowUpDraft[];
};

export type WizardAssistantPatch = {
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  visitClassification: VisitClassification;
  measurements: Record<string, string>;
  fieldVoiceNote: string;
  issues: BridgeIssueDraft[];
  recommendationGroups: RecommendationGroupDraft[];
  monitoringPlan: MonitoringPlanPreviewItem[];
  followUps: BridgeFollowUpDraft[];
  clearRecApproved: boolean;
  filledKeys: string[];
};

export type VisitAssistantOperationReview = {
  operation: VisitAssistantOperation;
  title: string;
  oldValue: string;
  newValue: string;
  riskLevel: 'standard' | 'critical';
  riskReasons: string[];
};

export function emptyVisitAssistantState(): VisitAssistantPersistedState {
  return {
    revision: 0,
    messages: [],
    history: [],
    pendingProposal: null,
    rejectedOperationIds: [],
    filledKeys: [],
    safetyConfirmation: null,
    recommendationValidation: null,
    workflow: emptyVisitCopilotWorkflow(),
  };
}

export function parseVisitAssistantState(raw: unknown): VisitAssistantPersistedState {
  const empty = emptyVisitAssistantState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
  const value = raw as Record<string, unknown>;
  return {
    revision:
      typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0
        ? value.revision
        : 0,
    messages: Array.isArray(value.messages) ? (value.messages as VisitAssistantMessage[]) : [],
    history: Array.isArray(value.history) ? (value.history as VisitAssistantHistoryItem[]) : [],
    pendingProposal: (value.pendingProposal as VisitAssistantProposalResponse | null) ?? null,
    rejectedOperationIds: Array.isArray(value.rejectedOperationIds)
      ? value.rejectedOperationIds.filter((id): id is string => typeof id === 'string')
      : [],
    filledKeys: Array.isArray(value.filledKeys)
      ? value.filledKeys.filter((key): key is string => typeof key === 'string')
      : [],
    safetyConfirmation: (value.safetyConfirmation as VisitAssistantSafetyConfirmation | null) ?? null,
    recommendationValidation:
      (value.recommendationValidation as VisitAssistantRecommendationValidationResult | null) ?? null,
    workflow: (value.workflow as VisitCopilotWorkflowState | null) ?? emptyVisitCopilotWorkflow(),
  };
}

function draftField<T>(value: T, revision: number): VisitAssistantStoredField<T> {
  return {
    value,
    confidence: 'high',
    provenance: 'draft',
    evidence: [],
    updatedAtRevision: revision,
  };
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '(empty)';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Build a reduced VisitAssistantSnapshot from current wizard React state. */
export function buildVisitAssistantSnapshot(
  wizard: WizardAssistantSource,
  assistant: Pick<
    VisitAssistantPersistedState,
    'revision' | 'messages' | 'history' | 'safetyConfirmation'
  >
): VisitAssistantSnapshot {
  const revision = assistant.revision;
  const assessments: VisitAssistantSnapshot['draft']['assessments'] = {};
  if (wizard.blockHealth) assessments.blockHealth = draftField(wizard.blockHealth, revision);
  if (wizard.cropPerformance) {
    assessments.cropPerformance = draftField(wizard.cropPerformance, revision);
  }
  if (wizard.soilMoisture) assessments.soilMoisture = draftField(wizard.soilMoisture, revision);

  const measurements: Record<string, VisitAssistantStoredField<string>> = {};
  for (const [key, value] of Object.entries(wizard.measurements)) {
    if (value?.trim()) measurements[key] = draftField(value, revision);
  }

  return {
    contractVersion: VISIT_ASSISTANT_CONTRACT_VERSION,
    revision,
    messages: assistant.messages,
    history: assistant.history,
    draft: {
      assessments,
      classification: draftField(wizard.visitClassification, revision),
      measurements,
      fieldNote: wizard.fieldVoiceNote.trim()
        ? draftField(wizard.fieldVoiceNote, revision)
        : undefined,
      issues: wizard.issues.map((issue) => ({
        ref: issue.localId,
        category: draftField(issue.category, revision),
        issueName: draftField(issue.issueName, revision),
        severity: draftField(issue.severity, revision),
        observation: issue.observation?.trim()
          ? draftField(issue.observation, revision)
          : undefined,
        status: issue.status ? draftField(issue.status, revision) : undefined,
        finalDiagnosis: issue.finalDiagnosis?.trim()
          ? draftField(issue.finalDiagnosis, revision)
          : undefined,
      })),
      recommendationGroups: wizard.recommendationGroups.map((group) => ({
        ref: group.localId,
        applicationType: draftField(group.applicationType, revision),
        applicationDay: draftField(group.applicationDay, revision),
        materials: group.materials.map((material) => ({
          ref: material.localId,
          issueRef: material.issueLocalId,
          category: draftField(material.category, revision),
          technicalName: draftField(material.technicalName, revision),
          doseQuantity: material.doseQuantity?.trim()
            ? draftField(material.doseQuantity, revision)
            : undefined,
          doseUnit: material.doseUnit ? draftField(material.doseUnit, revision) : undefined,
          doseBasis: material.doseBasis ? draftField(material.doseBasis, revision) : undefined,
          applicationMode: material.applicationMode
            ? draftField(material.applicationMode, revision)
            : undefined,
        })),
      })),
      monitoring: wizard.monitoringPlan.map((item) => ({
        ref: item.localId,
        issueRef: item.issueLocalId,
        intervalDays: draftField(item.intervalDays, revision),
        checkType: draftField(item.checkType, revision),
        severity: draftField(item.severity, revision),
      })),
      followUps: wizard.followUps.map((item) => ({
        recommendationRef: item.recommendationId,
        followed: draftField(item.followed, revision),
        outcome: draftField(item.outcome, revision),
        notes: item.notes.trim() ? draftField(item.notes, revision) : undefined,
      })),
      safetyConfirmation: assistant.safetyConfirmation,
    },
  };
}

function filledKeysForOperations(operations: readonly VisitAssistantOperation[]): string[] {
  const keys: string[] = [];
  for (const operation of operations) {
    switch (operation.kind) {
      case 'assessment.set':
        keys.push(`assessment.${operation.field}`);
        break;
      case 'classification.set':
        keys.push('classification');
        break;
      case 'measurement.set':
        keys.push(`measurement.${operation.key}`);
        break;
      case 'field_note.set':
      case 'field_note.append':
        keys.push('fieldNote');
        break;
      case 'issue.add':
        keys.push(`issue.add.${operation.id}`);
        break;
      case 'issue.update':
        keys.push(`issue.${operation.issueRef}`);
        break;
      case 'recommendation.group.add':
      case 'recommendation.group.update':
      case 'recommendation.material.add':
      case 'recommendation.material.update':
        keys.push(`recommendation.${operation.id}`);
        break;
      case 'monitoring.add':
      case 'monitoring.update':
        keys.push(`monitoring.${operation.id}`);
        break;
      case 'follow_up.set':
        keys.push(`followUp.${operation.recommendationRef}`);
        break;
    }
  }
  return keys;
}

function isCriticalTreatmentChange(operations: readonly VisitAssistantOperation[]): boolean {
  return operations.some((operation) => operation.kind.startsWith('recommendation.'));
}

/** Map an applied assistant snapshot draft back into wizard-shaped state (refs = localIds). */
export function mapSnapshotDraftToWizard(
  snapshot: VisitAssistantSnapshot,
  previous: WizardAssistantSource,
  appliedOperations: readonly VisitAssistantOperation[],
  safetyConfirmationInvalidated: boolean
): WizardAssistantPatch {
  const prevIssues = new Map(previous.issues.map((issue) => [issue.localId, issue]));
  const issues: BridgeIssueDraft[] = snapshot.draft.issues.map((issue) => {
    const prev = prevIssues.get(issue.ref);
    const base = prev ?? newBridgeIssue(issue.category.value, issue.ref);
    return {
      ...base,
      localId: issue.ref,
      category: issue.category.value,
      issueName: issue.issueName.value,
      severity: issue.severity.value,
      observation: issue.observation?.value ?? base.observation ?? '',
      status: (issue.status?.value ?? base.status ?? 'open') as IssueStatus,
      finalDiagnosis: issue.finalDiagnosis?.value ?? base.finalDiagnosis,
    };
  });

  const prevGroups = new Map(previous.recommendationGroups.map((group) => [group.localId, group]));
  const recommendationGroups: RecommendationGroupDraft[] = snapshot.draft.recommendationGroups.map(
    (group, index) => {
      const prev = prevGroups.get(group.ref);
      return {
        localId: group.ref,
        applicationType: group.applicationType.value,
        applicationDay: group.applicationDay.value,
        sortOrder: prev?.sortOrder ?? index,
        materials: group.materials.map((material) => ({
          localId: material.ref,
          issueLocalId: material.issueRef,
          category: material.category.value,
          technicalName: material.technicalName.value,
          doseQuantity: material.doseQuantity?.value,
          doseUnit: material.doseUnit?.value,
          doseBasis: material.doseBasis?.value,
          applicationMode: material.applicationMode?.value,
        })),
      };
    }
  );

  const prevMonitoring = new Map(previous.monitoringPlan.map((item) => [item.localId, item]));
  const monitoringPlan: MonitoringPlanPreviewItem[] = snapshot.draft.monitoring.map((item) => {
    const prev = prevMonitoring.get(item.ref);
    const issue = issues.find((candidate) => candidate.localId === item.issueRef);
    return {
      localId: item.ref,
      issueLocalId: item.issueRef,
      issueLabel: issue?.issueName || prev?.issueLabel || item.issueRef,
      intervalDays: item.intervalDays.value,
      checkType: item.checkType.value,
      severity: item.severity.value,
    };
  });

  const prevFollowUps = new Map(
    previous.followUps.map((item) => [item.recommendationId, item])
  );
  const followUps: BridgeFollowUpDraft[] = snapshot.draft.followUps.map((item) => {
    const prev = prevFollowUps.get(item.recommendationRef);
    return {
      recommendationId: item.recommendationRef,
      label: prev?.label ?? item.recommendationRef,
      followed: item.followed.value,
      outcome: item.outcome.value,
      notes: item.notes?.value ?? prev?.notes ?? '',
    };
  });

  const measurements: Record<string, string> = { ...previous.measurements };
  for (const [key, field] of Object.entries(snapshot.draft.measurements)) {
    measurements[key] = field.value;
  }

  return {
    blockHealth: snapshot.draft.assessments.blockHealth?.value ?? null,
    cropPerformance: snapshot.draft.assessments.cropPerformance?.value ?? null,
    soilMoisture: snapshot.draft.assessments.soilMoisture?.value ?? null,
    visitClassification:
      snapshot.draft.classification?.value ?? previous.visitClassification,
    measurements,
    fieldVoiceNote: snapshot.draft.fieldNote?.value ?? '',
    issues,
    recommendationGroups,
    monitoringPlan,
    followUps,
    clearRecApproved:
      safetyConfirmationInvalidated || isCriticalTreatmentChange(appliedOperations),
    filledKeys: filledKeysForOperations(appliedOperations),
  };
}

export function applyAcceptedOperationsToWizard(
  wizard: WizardAssistantSource,
  assistant: VisitAssistantPersistedState,
  proposal: VisitAssistantProposalResponse,
  request: VisitAssistantApplyRequest
): {
  applyResult: VisitAssistantApplyResult;
  patch?: WizardAssistantPatch;
  nextAssistant: VisitAssistantPersistedState;
} {
  const snapshot = buildVisitAssistantSnapshot(wizard, assistant);
  const applyResult = applyAcceptedVisitAssistantOperations(snapshot, proposal, request);
  if (!applyResult.ok) {
    return { applyResult, nextAssistant: assistant };
  }

  const appliedOps = proposal.operations.filter((operation) =>
    applyResult.appliedOperationIds.includes(operation.id)
  );
  const patch = mapSnapshotDraftToWizard(
    applyResult.snapshot,
    wizard,
    appliedOps,
    applyResult.safetyConfirmationInvalidated
  );
  const remainingOps = proposal.operations.filter(
    (operation) => !applyResult.appliedOperationIds.includes(operation.id)
  );
  const nextAssistant: VisitAssistantPersistedState = {
    ...assistant,
    revision: applyResult.snapshot.revision,
    messages: applyResult.snapshot.messages,
    safetyConfirmation: applyResult.snapshot.draft.safetyConfirmation,
    recommendationValidation: isCriticalTreatmentChange(appliedOps)
      ? null
      : assistant.recommendationValidation,
    filledKeys: Array.from(new Set([...assistant.filledKeys, ...patch.filledKeys])),
    pendingProposal: remainingOps.length
      ? { ...proposal, operations: remainingOps, baseRevision: applyResult.snapshot.revision }
      : null,
  };
  return { applyResult, patch, nextAssistant };
}

export function describeVisitAssistantOperation(
  operation: VisitAssistantOperation,
  snapshot: VisitAssistantSnapshot
): VisitAssistantOperationReview {
  const risk = classifyVisitAssistantOperation(operation);
  const draft = snapshot.draft;

  switch (operation.kind) {
    case 'assessment.set': {
      const current = draft.assessments[operation.field]?.value;
      return {
        operation,
        title: `Assessment · ${operation.field}`,
        oldValue: formatValue(current),
        newValue: formatValue(operation.proposed.value),
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    }
    case 'classification.set':
      return {
        operation,
        title: 'Visit classification',
        oldValue: formatValue(draft.classification?.value),
        newValue: formatValue(operation.proposed.value),
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    case 'measurement.set':
      return {
        operation,
        title: `Measurement · ${operation.key}`,
        oldValue: formatValue(draft.measurements[operation.key]?.value),
        newValue: formatValue(operation.proposed.value),
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    case 'field_note.set':
      return {
        operation,
        title: 'Field note',
        oldValue: formatValue(draft.fieldNote?.value),
        newValue: formatValue(operation.proposed.value),
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    case 'field_note.append': {
      const previous = draft.fieldNote?.value?.trim();
      return {
        operation,
        title: 'Field note (append)',
        oldValue: formatValue(previous),
        newValue: previous
          ? `${previous}\n${operation.proposed.value}`
          : formatValue(operation.proposed.value),
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    }
    case 'issue.add':
      return {
        operation,
        title: 'Add issue',
        oldValue: '(none)',
        newValue: `${operation.issue.issueName.value} · ${operation.issue.severity.value}`,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    case 'issue.update': {
      const issue = draft.issues.find((candidate) => candidate.ref === operation.issueRef);
      const changes = Object.entries(operation.changes)
        .map(([key, proposed]) => `${key}: ${formatValue(proposed?.value)}`)
        .join('; ');
      return {
        operation,
        title: `Update issue · ${issue?.issueName.value ?? operation.issueRef}`,
        oldValue: issue
          ? `${issue.issueName.value} · ${issue.severity.value}`
          : formatValue(operation.issueRef),
        newValue: changes,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    }
    case 'recommendation.group.add':
      return {
        operation,
        title: 'Add recommendation group',
        oldValue: '(none)',
        newValue: `${operation.group.applicationType.value} · day ${operation.group.applicationDay.value}`,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    case 'recommendation.group.update': {
      const group = draft.recommendationGroups.find(
        (candidate) => candidate.ref === operation.groupRef
      );
      return {
        operation,
        title: `Update recommendation group · ${operation.groupRef}`,
        oldValue: group
          ? `${group.applicationType.value} · day ${group.applicationDay.value}`
          : '(missing)',
        newValue: Object.entries(operation.changes)
          .map(([key, proposed]) => `${key}: ${formatValue(proposed?.value)}`)
          .join('; '),
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    }
    case 'recommendation.material.add':
      return {
        operation,
        title: 'Add material',
        oldValue: '(none)',
        newValue: `${operation.material.technicalName.value} (${operation.material.category.value})`,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    case 'recommendation.material.update': {
      const group = draft.recommendationGroups.find(
        (candidate) => candidate.ref === operation.groupRef
      );
      const material = group?.materials.find(
        (candidate) => candidate.ref === operation.materialRef
      );
      return {
        operation,
        title: `Update material · ${material?.technicalName.value ?? operation.materialRef}`,
        oldValue: material
          ? `${material.technicalName.value} (${material.category.value})`
          : '(missing)',
        newValue: Object.entries(operation.changes)
          .map(([key, proposed]) => `${key}: ${formatValue(proposed?.value)}`)
          .join('; '),
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    }
    case 'monitoring.add':
      return {
        operation,
        title: 'Add monitoring',
        oldValue: '(none)',
        newValue: `${operation.item.checkType.value} · every ${operation.item.intervalDays.value}d`,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    case 'monitoring.update': {
      const item = draft.monitoring.find(
        (candidate) => candidate.ref === operation.monitoringRef
      );
      return {
        operation,
        title: `Update monitoring · ${operation.monitoringRef}`,
        oldValue: item
          ? `${item.checkType.value} · every ${item.intervalDays.value}d`
          : '(missing)',
        newValue: Object.entries(operation.changes)
          .map(([key, proposed]) => `${key}: ${formatValue(proposed?.value)}`)
          .join('; '),
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
    }
    case 'follow_up.set':
      return {
        operation,
        title: `Follow-up · ${operation.recommendationRef}`,
        oldValue: formatValue(
          draft.followUps.find(
            (candidate) => candidate.recommendationRef === operation.recommendationRef
          )?.outcome.value
        ),
        newValue: `${operation.followUp.followed.value} · ${operation.followUp.outcome.value}`,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
      };
  }
}

export function standardPendingOperationIds(
  proposal: VisitAssistantProposalResponse,
  rejectedIds: readonly string[]
): string[] {
  const rejected = new Set(rejectedIds);
  return proposal.operations
    .filter(
      (operation) =>
        !rejected.has(operation.id)
        && classifyVisitAssistantOperation(operation).level === 'standard'
    )
    .map((operation) => operation.id);
}

export function createAssistantMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}
