import {
  VISIT_ASSISTANT_CONTRACT_VERSION,
  type VisitAssistantApplyRequest,
  type VisitAssistantApplyResult,
  type VisitAssistantEvidence,
  type VisitAssistantFieldProposal,
  type VisitAssistantMessage,
  type VisitAssistantOperation,
  type VisitAssistantProposalResponse,
  type VisitAssistantProposalRisk,
  type VisitAssistantSnapshot,
  type VisitAssistantStoredField,
} from './v1.js';

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const CONFIDENCE = ['low', 'medium', 'high'] as const;
const PROVENANCE = [
  'assistant_inference',
  'agronomist_message',
  'draft',
  'field_observation',
  'farmer_history',
  'measurement',
  'soil_report',
  'weather',
] as const;
const BLOCK_HEALTH = ['good', 'average', 'need_assistance'] as const;
const CROP_PERFORMANCE = ['above_expectation', 'as_expected', 'below_expectation'] as const;
const SOIL_MOISTURE = ['dry', 'optimal', 'wet', 'waterlogged'] as const;
const CLASSIFICATION = ['first', 'follow_up', 'rectification'] as const;
const ISSUE_CATEGORY = [
  'disease',
  'pest',
  'nutrient_deficiency',
  'nutrient_toxicity',
  'water_stress',
  'environmental_stress',
  'soil_problem',
  'growth_issue',
  'chemical_injury',
  'mechanical_damage',
  'weed',
  'other',
] as const;
const SEVERITY = ['low', 'medium', 'high'] as const;
const ISSUE_STATUS = ['open', 'monitoring', 'resolved'] as const;
const DOSE_UNIT = ['KG', 'LTR', 'ML'] as const;
const DOSE_BASIS = ['per_200_ltr_water', 'per_acre'] as const;
const APPLICATION_MODE = ['foliar', 'soil_application', 'drenching'] as const;
const FOLLOWED = ['yes', 'partially', 'no', 'not_applicable'] as const;
const OUTCOME = ['improved', 'no_change', 'worsened', 'not_reviewed'] as const;
const OPERATION_KINDS = [
  'assessment.set',
  'classification.set',
  'measurement.set',
  'field_note.set',
  'field_note.append',
  'issue.add',
  'issue.update',
  'recommendation.group.add',
  'recommendation.group.update',
  'recommendation.material.add',
  'recommendation.material.update',
  'monitoring.add',
  'monitoring.update',
  'follow_up.set',
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEnum<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const keys = Object.keys(value);
  return required.every((key) => key in value)
    && keys.every((key) => required.includes(key) || optional.includes(key));
}

function isSafeText(value: unknown, allowEmpty = false): value is string {
  return typeof value === 'string'
    && value.length <= 10_000
    && (allowEmpty || value.trim().length > 0);
}

function isSafeRef(value: unknown): value is string {
  return isSafeText(value)
    && value.length <= 200
    && !['__proto__', 'prototype', 'constructor'].includes(value);
}

function validEvidence(value: unknown): value is VisitAssistantEvidence {
  if (!isObject(value) || !isEnum(value.kind, [
    'message',
    'measurement',
    'field_note',
    'issue',
    'photo',
    'farmer_history',
    'soil_report',
    'weather',
  ] as const)) return false;
  const optionalExcerpt = value.excerpt === undefined || isSafeText(value.excerpt, true);
  if (!optionalExcerpt) return false;
  switch (value.kind) {
    case 'message':
      return hasExactKeys(value, ['kind', 'messageId'], ['excerpt']) && isSafeRef(value.messageId);
    case 'measurement':
      return hasExactKeys(value, ['kind', 'key'], ['excerpt']) && isSafeRef(value.key);
    case 'field_note':
      return hasExactKeys(value, ['kind', 'excerpt']) && isSafeText(value.excerpt, true);
    case 'issue':
      return hasExactKeys(value, ['kind', 'issueRef'], ['excerpt']) && isSafeRef(value.issueRef);
    case 'photo':
      return hasExactKeys(value, ['kind', 'photoRef'], ['excerpt']) && isSafeRef(value.photoRef);
    case 'farmer_history':
    case 'soil_report':
      return hasExactKeys(value, ['kind', 'recordRef'], ['excerpt']) && isSafeRef(value.recordRef);
    case 'weather':
      return hasExactKeys(value, ['kind', 'observedAt'], ['excerpt']) && isSafeText(value.observedAt);
  }
}

function validProposal<T>(
  value: unknown,
  validValue: (candidate: unknown) => candidate is T
): value is VisitAssistantFieldProposal<T> {
  return isObject(value)
    && hasExactKeys(value, ['value', 'confidence', 'provenance', 'evidence'])
    && validValue(value.value)
    && isEnum(value.confidence, CONFIDENCE)
    && isEnum(value.provenance, PROVENANCE)
    && Array.isArray(value.evidence)
    && value.evidence.every(validEvidence);
}

const stringProposal = (value: unknown): value is VisitAssistantFieldProposal<string> =>
  validProposal(value, (candidate): candidate is string => isSafeText(candidate));
const nonNegativeIntegerProposal = (value: unknown): value is VisitAssistantFieldProposal<number> =>
  validProposal(value, (candidate): candidate is number =>
    typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0);

function validMessage(value: unknown): value is VisitAssistantMessage {
  return isObject(value)
    && hasExactKeys(value, ['id', 'role', 'content', 'createdAt'])
    && isSafeRef(value.id)
    && isEnum(value.role, ['agronomist', 'assistant', 'system'] as const)
    && isSafeText(value.content)
    && isSafeText(value.createdAt);
}

function validProposalMap(
  value: unknown,
  fields: Record<string, (candidate: unknown) => boolean>,
  required: readonly string[] = []
): boolean {
  if (!isObject(value) || !hasExactKeys(value, required, Object.keys(fields))) return false;
  return Object.entries(value).every(([key, candidate]) => fields[key]?.(candidate) === true);
}

function validOperation(value: unknown): value is VisitAssistantOperation {
  if (!isObject(value) || !isSafeRef(value.id) || !isEnum(value.kind, OPERATION_KINDS)) return false;
  switch (value.kind) {
    case 'assessment.set': {
      if (!hasExactKeys(value, ['id', 'kind', 'field', 'proposed'])) return false;
      if (value.field === 'blockHealth') {
        return validProposal(value.proposed, (candidate): candidate is typeof BLOCK_HEALTH[number] =>
          isEnum(candidate, BLOCK_HEALTH));
      }
      if (value.field === 'cropPerformance') {
        return validProposal(value.proposed, (candidate): candidate is typeof CROP_PERFORMANCE[number] =>
          isEnum(candidate, CROP_PERFORMANCE));
      }
      return value.field === 'soilMoisture'
        && validProposal(value.proposed, (candidate): candidate is typeof SOIL_MOISTURE[number] =>
          isEnum(candidate, SOIL_MOISTURE));
    }
    case 'classification.set':
      return hasExactKeys(value, ['id', 'kind', 'proposed'])
        && validProposal(value.proposed, (candidate): candidate is typeof CLASSIFICATION[number] =>
          isEnum(candidate, CLASSIFICATION));
    case 'measurement.set':
      return hasExactKeys(value, ['id', 'kind', 'key', 'proposed'])
        && isSafeRef(value.key) && stringProposal(value.proposed);
    case 'field_note.set':
    case 'field_note.append':
      return hasExactKeys(value, ['id', 'kind', 'proposed']) && stringProposal(value.proposed);
    case 'issue.add':
      return hasExactKeys(value, ['id', 'kind', 'issue'])
        && validProposalMap(value.issue, {
          category: (v) => validProposal(v, (x): x is typeof ISSUE_CATEGORY[number] => isEnum(x, ISSUE_CATEGORY)),
          issueName: stringProposal,
          severity: (v) => validProposal(v, (x): x is typeof SEVERITY[number] => isEnum(x, SEVERITY)),
          observation: stringProposal,
          status: (v) => validProposal(v, (x): x is typeof ISSUE_STATUS[number] => isEnum(x, ISSUE_STATUS)),
          finalDiagnosis: stringProposal,
        }, ['category', 'issueName', 'severity']);
    case 'issue.update':
      return hasExactKeys(value, ['id', 'kind', 'issueRef', 'changes'])
        && isSafeRef(value.issueRef)
        && validProposalMap(value.changes, {
          category: (v) => validProposal(v, (x): x is typeof ISSUE_CATEGORY[number] => isEnum(x, ISSUE_CATEGORY)),
          issueName: stringProposal,
          severity: (v) => validProposal(v, (x): x is typeof SEVERITY[number] => isEnum(x, SEVERITY)),
          observation: stringProposal,
          status: (v) => validProposal(v, (x): x is typeof ISSUE_STATUS[number] => isEnum(x, ISSUE_STATUS)),
          finalDiagnosis: stringProposal,
        }) && Object.keys(value.changes as object).length > 0;
    case 'recommendation.group.add':
      return hasExactKeys(value, ['id', 'kind', 'group'])
        && validProposalMap(value.group, {
          applicationType: stringProposal,
          applicationDay: nonNegativeIntegerProposal,
        }, ['applicationType', 'applicationDay']);
    case 'recommendation.group.update':
      return hasExactKeys(value, ['id', 'kind', 'groupRef', 'changes'])
        && isSafeRef(value.groupRef)
        && validProposalMap(value.changes, {
          applicationType: stringProposal,
          applicationDay: nonNegativeIntegerProposal,
        }) && Object.keys(value.changes as object).length > 0;
    case 'recommendation.material.add':
      return hasExactKeys(value, ['id', 'kind', 'groupRef', 'material'])
        && isSafeRef(value.groupRef)
        && validProposalMap(value.material, {
          issueRef: isSafeRef,
          category: stringProposal,
          technicalName: stringProposal,
          doseQuantity: stringProposal,
          doseUnit: (v) => validProposal(v, (x): x is typeof DOSE_UNIT[number] => isEnum(x, DOSE_UNIT)),
          doseBasis: (v) => validProposal(v, (x): x is typeof DOSE_BASIS[number] => isEnum(x, DOSE_BASIS)),
          applicationMode: (v) => validProposal(v, (x): x is typeof APPLICATION_MODE[number] => isEnum(x, APPLICATION_MODE)),
        }, ['issueRef', 'category', 'technicalName']);
    case 'recommendation.material.update':
      return hasExactKeys(value, ['id', 'kind', 'groupRef', 'materialRef', 'changes'])
        && isSafeRef(value.groupRef) && isSafeRef(value.materialRef)
        && validProposalMap(value.changes, {
          category: stringProposal,
          technicalName: stringProposal,
          doseQuantity: stringProposal,
          doseUnit: (v) => validProposal(v, (x): x is typeof DOSE_UNIT[number] => isEnum(x, DOSE_UNIT)),
          doseBasis: (v) => validProposal(v, (x): x is typeof DOSE_BASIS[number] => isEnum(x, DOSE_BASIS)),
          applicationMode: (v) => validProposal(v, (x): x is typeof APPLICATION_MODE[number] => isEnum(x, APPLICATION_MODE)),
        }) && Object.keys(value.changes as object).length > 0;
    case 'monitoring.add':
      return hasExactKeys(value, ['id', 'kind', 'item'])
        && validProposalMap(value.item, {
          issueRef: isSafeRef,
          intervalDays: nonNegativeIntegerProposal,
          checkType: stringProposal,
          severity: (v) => validProposal(v, (x): x is typeof SEVERITY[number] => isEnum(x, SEVERITY)),
        }, ['issueRef', 'intervalDays', 'checkType', 'severity']);
    case 'monitoring.update':
      return hasExactKeys(value, ['id', 'kind', 'monitoringRef', 'changes'])
        && isSafeRef(value.monitoringRef)
        && validProposalMap(value.changes, {
          intervalDays: nonNegativeIntegerProposal,
          checkType: stringProposal,
          severity: (v) => validProposal(v, (x): x is typeof SEVERITY[number] => isEnum(x, SEVERITY)),
        }) && Object.keys(value.changes as object).length > 0;
    case 'follow_up.set':
      return hasExactKeys(value, ['id', 'kind', 'recommendationRef', 'followUp'])
        && isSafeRef(value.recommendationRef)
        && validProposalMap(value.followUp, {
          followed: (v) => validProposal(v, (x): x is typeof FOLLOWED[number] => isEnum(x, FOLLOWED)),
          outcome: (v) => validProposal(v, (x): x is typeof OUTCOME[number] => isEnum(x, OUTCOME)),
          notes: stringProposal,
        }, ['followed', 'outcome']);
  }
}

function validTarget(value: unknown): boolean {
  if (!isObject(value) || !isEnum(value.kind, [
    'assessment',
    'classification',
    'measurement',
    'field_note',
    'issue',
    'recommendation',
    'monitoring',
    'follow_up',
  ] as const)) return false;
  switch (value.kind) {
    case 'assessment':
      return hasExactKeys(value, ['kind', 'field'])
        && isEnum(value.field, ['blockHealth', 'cropPerformance', 'soilMoisture'] as const);
    case 'classification':
    case 'field_note':
      return hasExactKeys(value, ['kind']);
    case 'measurement':
      return hasExactKeys(value, ['kind', 'key']) && isSafeRef(value.key);
    case 'issue':
      return hasExactKeys(value, ['kind'], ['issueRef', 'field'])
        && (value.issueRef === undefined || isSafeRef(value.issueRef))
        && (value.field === undefined || isEnum(value.field, [
          'category', 'issueName', 'severity', 'observation', 'status', 'finalDiagnosis',
        ] as const));
    case 'recommendation':
      return hasExactKeys(value, ['kind'], ['groupRef', 'materialRef'])
        && (value.groupRef === undefined || isSafeRef(value.groupRef))
        && (value.materialRef === undefined || isSafeRef(value.materialRef));
    case 'monitoring':
      return hasExactKeys(value, ['kind'], ['monitoringRef'])
        && (value.monitoringRef === undefined || isSafeRef(value.monitoringRef));
    case 'follow_up':
      return hasExactKeys(value, ['kind', 'recommendationRef']) && isSafeRef(value.recommendationRef);
  }
}

export function validateVisitAssistantOperation(value: unknown): ValidationResult<VisitAssistantOperation> {
  return validOperation(value)
    ? { ok: true, value }
    : { ok: false, errors: ['Operation is not a strict visit-assistant/v1 allowlisted operation.'] };
}

export function validateVisitAssistantProposalResponse(
  value: unknown
): ValidationResult<VisitAssistantProposalResponse> {
  const errors: string[] = [];
  if (!isObject(value) || !hasExactKeys(value, [
    'contractVersion',
    'proposalId',
    'baseRevision',
    'messages',
    'operations',
    'clarifications',
    'unresolvedFields',
  ])) {
    return { ok: false, errors: ['Proposal response has missing or unknown top-level fields.'] };
  }
  if (value.contractVersion !== VISIT_ASSISTANT_CONTRACT_VERSION) errors.push('Unsupported contractVersion.');
  if (!isSafeRef(value.proposalId)) errors.push('proposalId must be a non-empty safe identifier.');
  if (!Number.isSafeInteger(value.baseRevision) || (value.baseRevision as number) < 0) {
    errors.push('baseRevision must be a non-negative integer.');
  }
  if (!Array.isArray(value.messages) || !value.messages.every(validMessage)) errors.push('messages are invalid.');
  if (!Array.isArray(value.operations) || !value.operations.every(validOperation)) errors.push('operations are invalid.');
  const operationIds = Array.isArray(value.operations)
    ? value.operations.filter(isObject).map((operation) => operation.id)
    : [];
  if (new Set(operationIds).size !== operationIds.length) errors.push('operation ids must be unique.');
  if (!Array.isArray(value.clarifications) || !value.clarifications.every((item) =>
    isObject(item)
    && hasExactKeys(item, ['id', 'question', 'target', 'required'])
    && isSafeRef(item.id)
    && isSafeText(item.question)
    && validTarget(item.target)
    && typeof item.required === 'boolean')) errors.push('clarifications are invalid.');
  if (!Array.isArray(value.unresolvedFields) || !value.unresolvedFields.every((item) =>
    isObject(item)
    && hasExactKeys(item, ['target', 'reason', 'detail'])
    && validTarget(item.target)
    && isEnum(item.reason, [
      'missing_information', 'ambiguous', 'conflicting_evidence', 'requires_agronomist',
    ] as const)
    && isSafeText(item.detail))) errors.push('unresolvedFields are invalid.');
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: value as VisitAssistantProposalResponse };
}

export function classifyVisitAssistantOperation(
  operation: VisitAssistantOperation
): VisitAssistantProposalRisk {
  const reasons: string[] = [];
  if (operation.kind.startsWith('recommendation.')) reasons.push('changes treatment recommendations');
  if (operation.kind === 'classification.set' && operation.proposed.value === 'rectification') {
    reasons.push('marks the visit as rectification');
  }
  if (operation.kind === 'assessment.set'
    && (operation.proposed.value === 'waterlogged' || operation.proposed.value === 'need_assistance')) {
    reasons.push('records a critical block assessment');
  }
  if (operation.kind === 'issue.add'
    && (operation.issue.severity.value === 'high' || operation.issue.finalDiagnosis)) {
    reasons.push('adds a high-severity or diagnosed issue');
  }
  if (operation.kind === 'issue.update'
    && (operation.changes.severity?.value === 'high' || operation.changes.finalDiagnosis)) {
    reasons.push('changes a high-severity issue or diagnosis');
  }
  if (operation.kind === 'monitoring.add' && operation.item.severity.value === 'high') {
    reasons.push('adds high-severity monitoring');
  }
  if (operation.kind === 'monitoring.update' && operation.changes.severity?.value === 'high') {
    reasons.push('raises monitoring severity');
  }
  if (operation.kind === 'follow_up.set' && operation.followUp.outcome.value === 'worsened') {
    reasons.push('records a worsened follow-up outcome');
  }
  return { level: reasons.length ? 'critical' : 'standard', reasons };
}

export function classifyVisitAssistantProposal(
  operations: readonly VisitAssistantOperation[]
): VisitAssistantProposalRisk {
  const reasons = operations.flatMap((operation) =>
    classifyVisitAssistantOperation(operation).reasons.map((reason) => `${operation.id}: ${reason}`));
  return { level: reasons.length ? 'critical' : 'standard', reasons };
}

function stored<T>(proposal: VisitAssistantFieldProposal<T>, revision: number): VisitAssistantStoredField<T> {
  return { ...proposal, evidence: [...proposal.evidence], updatedAtRevision: revision };
}

function assistantRef(proposalId: string, operationId: string): string {
  return `assistant:${proposalId}:${operationId}`;
}

/**
 * Applies an accepted subset atomically. Any invalid reference or stale base
 * returns a conflict and leaves the caller-owned snapshot untouched.
 */
export function applyAcceptedVisitAssistantOperations(
  snapshot: VisitAssistantSnapshot,
  proposalValue: unknown,
  request: VisitAssistantApplyRequest
): VisitAssistantApplyResult {
  const validated = validateVisitAssistantProposalResponse(proposalValue);
  if (!validated.ok) return { ok: false, error: { code: 'invalid_proposal', errors: validated.errors } };
  const proposal = validated.value;
  if (proposal.baseRevision !== snapshot.revision) {
    return {
      ok: false,
      error: {
        code: 'stale_base_revision',
        expectedRevision: proposal.baseRevision,
        actualRevision: snapshot.revision,
      },
    };
  }
  const acceptedIds = new Set(request.acceptedOperationIds);
  if (acceptedIds.size !== request.acceptedOperationIds.length) {
    return { ok: false, error: { code: 'conflict', detail: 'acceptedOperationIds contains duplicates.' } };
  }
  const operationById = new Map(proposal.operations.map((operation) => [operation.id, operation]));
  const unknownId = request.acceptedOperationIds.find((id) => !operationById.has(id));
  if (unknownId) {
    return { ok: false, error: { code: 'conflict', operationId: unknownId, detail: 'Unknown operation id.' } };
  }
  const operations = proposal.operations.filter((operation) => acceptedIds.has(operation.id));
  const critical = operations.filter((operation) =>
    classifyVisitAssistantOperation(operation).level === 'critical');
  if (critical.length && request.explicitCriticalConfirmation !== true) {
    return {
      ok: false,
      error: { code: 'critical_confirmation_required', operationIds: critical.map((operation) => operation.id) },
    };
  }

  const next = JSON.parse(JSON.stringify(snapshot)) as VisitAssistantSnapshot;
  const revision = snapshot.revision + 1;
  const addedRefs = new Map(operations
    .filter((operation) => [
      'issue.add',
      'recommendation.group.add',
      'recommendation.material.add',
      'monitoring.add',
    ].includes(operation.kind))
    .map((operation) => [operation.id, assistantRef(proposal.proposalId, operation.id)]));
  const resolveRef = (ref: string) => addedRefs.get(ref) ?? ref;
  const conflict = (operationId: string, detail: string): VisitAssistantApplyResult =>
    ({ ok: false, error: { code: 'conflict', operationId, detail } });

  for (const operation of operations) {
    switch (operation.kind) {
      case 'assessment.set':
        next.draft.assessments[operation.field] = stored(operation.proposed, revision) as never;
        break;
      case 'classification.set':
        next.draft.classification = stored(operation.proposed, revision);
        break;
      case 'measurement.set':
        next.draft.measurements[operation.key] = stored(operation.proposed, revision);
        break;
      case 'field_note.set':
        next.draft.fieldNote = stored(operation.proposed, revision);
        break;
      case 'field_note.append': {
        const previous = next.draft.fieldNote?.value.trim();
        next.draft.fieldNote = stored({
          ...operation.proposed,
          value: previous ? `${previous}\n${operation.proposed.value}` : operation.proposed.value,
        }, revision);
        break;
      }
      case 'issue.add':
        next.draft.issues.push({
          ref: addedRefs.get(operation.id)!,
          category: stored(operation.issue.category, revision),
          issueName: stored(operation.issue.issueName, revision),
          severity: stored(operation.issue.severity, revision),
          observation: operation.issue.observation && stored(operation.issue.observation, revision),
          status: operation.issue.status && stored(operation.issue.status, revision),
          finalDiagnosis: operation.issue.finalDiagnosis && stored(operation.issue.finalDiagnosis, revision),
        });
        break;
      case 'issue.update': {
        const issue = next.draft.issues.find((candidate) => candidate.ref === resolveRef(operation.issueRef));
        if (!issue) return conflict(operation.id, `Unknown issueRef: ${operation.issueRef}`);
        for (const [key, proposed] of Object.entries(operation.changes)) {
          (issue as unknown as Record<string, unknown>)[key] = stored(proposed as VisitAssistantFieldProposal<unknown>, revision);
        }
        break;
      }
      case 'recommendation.group.add':
        next.draft.recommendationGroups.push({
          ref: addedRefs.get(operation.id)!,
          applicationType: stored(operation.group.applicationType, revision),
          applicationDay: stored(operation.group.applicationDay, revision),
          materials: [],
        });
        break;
      case 'recommendation.group.update': {
        const group = next.draft.recommendationGroups.find((candidate) =>
          candidate.ref === resolveRef(operation.groupRef));
        if (!group) return conflict(operation.id, `Unknown groupRef: ${operation.groupRef}`);
        if (operation.changes.applicationType) {
          group.applicationType = stored(operation.changes.applicationType, revision);
        }
        if (operation.changes.applicationDay) {
          group.applicationDay = stored(operation.changes.applicationDay, revision);
        }
        break;
      }
      case 'recommendation.material.add': {
        const group = next.draft.recommendationGroups.find((candidate) =>
          candidate.ref === resolveRef(operation.groupRef));
        if (!group) return conflict(operation.id, `Unknown groupRef: ${operation.groupRef}`);
        const issueRef = resolveRef(operation.material.issueRef);
        if (!next.draft.issues.some((candidate) => candidate.ref === issueRef)) {
          return conflict(operation.id, `Unknown issueRef: ${operation.material.issueRef}`);
        }
        group.materials.push({
          ref: addedRefs.get(operation.id)!,
          issueRef,
          category: stored(operation.material.category, revision),
          technicalName: stored(operation.material.technicalName, revision),
          doseQuantity: operation.material.doseQuantity && stored(operation.material.doseQuantity, revision),
          doseUnit: operation.material.doseUnit && stored(operation.material.doseUnit, revision),
          doseBasis: operation.material.doseBasis && stored(operation.material.doseBasis, revision),
          applicationMode: operation.material.applicationMode && stored(operation.material.applicationMode, revision),
        });
        break;
      }
      case 'recommendation.material.update': {
        const group = next.draft.recommendationGroups.find((candidate) =>
          candidate.ref === resolveRef(operation.groupRef));
        const material = group?.materials.find((candidate) =>
          candidate.ref === resolveRef(operation.materialRef));
        if (!group || !material) return conflict(operation.id, 'Unknown recommendation group or material reference.');
        for (const [key, proposed] of Object.entries(operation.changes)) {
          (material as unknown as Record<string, unknown>)[key] =
            stored(proposed as VisitAssistantFieldProposal<unknown>, revision);
        }
        break;
      }
      case 'monitoring.add': {
        const issueRef = resolveRef(operation.item.issueRef);
        if (!next.draft.issues.some((candidate) => candidate.ref === issueRef)) {
          return conflict(operation.id, `Unknown issueRef: ${operation.item.issueRef}`);
        }
        next.draft.monitoring.push({
          ref: addedRefs.get(operation.id)!,
          issueRef,
          intervalDays: stored(operation.item.intervalDays, revision),
          checkType: stored(operation.item.checkType, revision),
          severity: stored(operation.item.severity, revision),
        });
        break;
      }
      case 'monitoring.update': {
        const item = next.draft.monitoring.find((candidate) =>
          candidate.ref === resolveRef(operation.monitoringRef));
        if (!item) return conflict(operation.id, `Unknown monitoringRef: ${operation.monitoringRef}`);
        for (const [key, proposed] of Object.entries(operation.changes)) {
          (item as unknown as Record<string, unknown>)[key] =
            stored(proposed as VisitAssistantFieldProposal<unknown>, revision);
        }
        break;
      }
      case 'follow_up.set': {
        const recommendationRef = resolveRef(operation.recommendationRef);
        const existing = next.draft.followUps.find((candidate) =>
          candidate.recommendationRef === recommendationRef);
        const followUp = {
          recommendationRef,
          followed: stored(operation.followUp.followed, revision),
          outcome: stored(operation.followUp.outcome, revision),
          notes: operation.followUp.notes && stored(operation.followUp.notes, revision),
        };
        if (existing) Object.assign(existing, followUp);
        else next.draft.followUps.push(followUp);
        break;
      }
    }
  }

  next.revision = revision;
  next.messages = [
    ...next.messages,
    ...proposal.messages.filter((message) => !next.messages.some((existing) => existing.id === message.id)),
  ];
  const safetyConfirmationInvalidated = critical.length > 0 && snapshot.draft.safetyConfirmation !== null;
  if (critical.length) next.draft.safetyConfirmation = null;
  return {
    ok: true,
    snapshot: next,
    appliedOperationIds: operations.map((operation) => operation.id),
    safetyConfirmationInvalidated,
  };
}

