import { randomUUID } from 'node:crypto';
import {
  VISIT_ASSISTANT_CONTRACT_VERSION,
  validateVisitAssistantProposalResponse,
  type VisitAssistantOperation,
  type VisitAssistantProposalResponse,
  type VisitAssistantSnapshot,
} from '@morbeez/shared/visit-assistant';
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { fieldFindingsMastersService } from '../admin/field-findings-masters.service.js';
import { blockService } from '../core/block.service.js';
import { openaiStrictJsonSchemaCompletion } from '../ai/providers/openai.provider.js';

type IssueMaster = Awaited<ReturnType<typeof fieldFindingsMastersService.listIssueMaster>>[number];
type MeasurementTemplate = Awaited<ReturnType<typeof fieldFindingsMastersService.listMeasurementTemplates>>[number];

const text = (maxLength = 2_000) => ({ type: 'string', minLength: 1, maxLength });
const ref = () => text(200);
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const enumString = (values: readonly string[]) => ({ type: 'string', enum: values });

const evidence = {
  anyOf: [
    object({ kind: { const: 'message' }, messageId: ref() }),
    object({ kind: { const: 'measurement' }, key: ref() }),
    object({ kind: { const: 'field_note' }, excerpt: text(500) }),
    object({ kind: { const: 'issue' }, issueRef: ref() }),
    object({ kind: { const: 'photo' }, photoRef: ref() }),
    object({ kind: { const: 'farmer_history' }, recordRef: ref() }),
    object({ kind: { const: 'soil_report' }, recordRef: ref() }),
    object({ kind: { const: 'weather' }, observedAt: text(100) }),
  ],
};
const proposal = (value: unknown) => object({
  value,
  confidence: enumString(['low', 'medium', 'high']),
  provenance: enumString([
    'assistant_inference', 'agronomist_message', 'draft', 'field_observation',
    'farmer_history', 'measurement', 'soil_report', 'weather',
  ]),
  evidence: { type: 'array', maxItems: 8, items: evidence },
});
const stringProposal = proposal(text());
const severityProposal = proposal(enumString(['low', 'medium', 'high']));
const issueCategoryProposal = proposal(enumString([
  'disease', 'pest', 'nutrient_deficiency', 'nutrient_toxicity', 'water_stress',
  'environmental_stress', 'soil_problem', 'growth_issue', 'chemical_injury',
  'mechanical_damage', 'weed', 'other',
]));

const operationSchemas: unknown[] = [
  object({ id: ref(), kind: { const: 'assessment.set' }, field: enumString(['blockHealth']), proposed: proposal(enumString(['good', 'average', 'need_assistance'])) }),
  object({ id: ref(), kind: { const: 'assessment.set' }, field: enumString(['cropPerformance']), proposed: proposal(enumString(['above_expectation', 'as_expected', 'below_expectation'])) }),
  object({ id: ref(), kind: { const: 'assessment.set' }, field: enumString(['soilMoisture']), proposed: proposal(enumString(['dry', 'optimal', 'wet', 'waterlogged'])) }),
  object({ id: ref(), kind: { const: 'classification.set' }, proposed: proposal(enumString(['first', 'follow_up', 'rectification'])) }),
  object({ id: ref(), kind: { const: 'measurement.set' }, key: ref(), proposed: stringProposal }),
  object({ id: ref(), kind: enumString(['field_note.set', 'field_note.append']), proposed: stringProposal }),
  object({
    id: ref(), kind: { const: 'issue.add' },
    issue: object({ category: issueCategoryProposal, issueName: stringProposal, severity: severityProposal }),
  }),
  ...['category', 'issueName', 'severity', 'observation', 'status', 'finalDiagnosis'].map((field) =>
    object({
      id: ref(), kind: { const: 'issue.update' }, issueRef: ref(),
      changes: object({
        [field]: field === 'category' ? issueCategoryProposal
          : field === 'severity' ? severityProposal
            : field === 'status' ? proposal(enumString(['open', 'monitoring', 'resolved']))
              : stringProposal,
      }),
    })),
  object({
    id: ref(), kind: { const: 'recommendation.group.add' },
    group: object({ applicationType: stringProposal, applicationDay: proposal({ type: 'integer', minimum: 0, maximum: 365 }) }),
  }),
  ...['applicationType', 'applicationDay'].map((field) => object({
    id: ref(), kind: { const: 'recommendation.group.update' }, groupRef: ref(),
    changes: object({ [field]: field === 'applicationDay' ? proposal({ type: 'integer', minimum: 0, maximum: 365 }) : stringProposal }),
  })),
  object({
    id: ref(), kind: { const: 'recommendation.material.add' }, groupRef: ref(),
    material: object({ issueRef: ref(), category: stringProposal, technicalName: stringProposal }),
  }),
  ...['category', 'technicalName', 'doseQuantity', 'doseUnit', 'doseBasis', 'applicationMode'].map((field) => object({
    id: ref(), kind: { const: 'recommendation.material.update' }, groupRef: ref(), materialRef: ref(),
    changes: object({
      [field]: field === 'doseUnit' ? proposal(enumString(['KG', 'LTR', 'ML']))
        : field === 'doseBasis' ? proposal(enumString(['per_200_ltr_water', 'per_acre']))
          : field === 'applicationMode' ? proposal(enumString(['foliar', 'soil_application', 'drenching']))
            : stringProposal,
    }),
  })),
  object({
    id: ref(), kind: { const: 'monitoring.add' },
    item: object({
      issueRef: ref(),
      intervalDays: proposal({ type: 'integer', minimum: 0, maximum: 365 }),
      checkType: stringProposal,
      severity: severityProposal,
    }),
  }),
  ...['intervalDays', 'checkType', 'severity'].map((field) => object({
    id: ref(), kind: { const: 'monitoring.update' }, monitoringRef: ref(),
    changes: object({
      [field]: field === 'intervalDays' ? proposal({ type: 'integer', minimum: 0, maximum: 365 })
        : field === 'severity' ? severityProposal : stringProposal,
    }),
  })),
  object({
    id: ref(), kind: { const: 'follow_up.set' }, recommendationRef: ref(),
    followUp: object({
      followed: proposal(enumString(['yes', 'partially', 'no', 'not_applicable'])),
      outcome: proposal(enumString(['improved', 'no_change', 'worsened', 'not_reviewed'])),
    }),
  }),
];

const target = {
  anyOf: [
    object({ kind: { const: 'assessment' }, field: enumString(['blockHealth', 'cropPerformance', 'soilMoisture']) }),
    object({ kind: { const: 'classification' } }),
    object({ kind: { const: 'measurement' }, key: ref() }),
    object({ kind: { const: 'field_note' } }),
    object({ kind: { const: 'issue' } }),
    object({ kind: { const: 'issue' }, field: enumString(['category', 'issueName', 'severity', 'observation', 'status', 'finalDiagnosis']) }),
    object({ kind: { const: 'recommendation' } }),
    object({ kind: { const: 'monitoring' } }),
    object({ kind: { const: 'follow_up' }, recommendationRef: ref() }),
  ],
};

export const VISIT_ASSISTANT_RESPONSE_SCHEMA = object({
  contractVersion: { const: VISIT_ASSISTANT_CONTRACT_VERSION },
  proposalId: ref(),
  baseRevision: { type: 'integer', minimum: 0 },
  messages: {
    type: 'array', maxItems: 4, items: object({
      id: ref(), role: { const: 'assistant' }, content: text(), createdAt: text(100),
    }),
  },
  operations: { type: 'array', maxItems: 20, items: { anyOf: operationSchemas } },
  clarifications: {
    type: 'array', maxItems: 5, items: object({
      id: ref(), question: text(1_000), target, required: { type: 'boolean' },
    }),
  },
  unresolvedFields: {
    type: 'array', maxItems: 10, items: object({
      target,
      reason: enumString(['missing_information', 'ambiguous', 'conflicting_evidence', 'requires_agronomist']),
      detail: text(1_000),
    }),
  },
});

export type VisitAssistantSemanticContext = {
  snapshot: VisitAssistantSnapshot;
  userMessageId: string;
  issueMaster: IssueMaster[];
  measurementTemplates: MeasurementTemplate[];
};

function canonicalKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function proposalContainers(operation: VisitAssistantOperation): Array<Record<string, unknown>> {
  const raw = operation as unknown as Record<string, unknown>;
  const nested = raw.proposed ?? raw.issue ?? raw.changes ?? raw.group ?? raw.material ?? raw.item ?? raw.followUp;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return [];
  return 'value' in (nested as object)
    ? [nested as Record<string, unknown>]
    : Object.values(nested).filter((v): v is Record<string, unknown> =>
      Boolean(v && typeof v === 'object' && !Array.isArray(v) && 'value' in v));
}

export function normalizeVisitAssistantProposal(
  value: VisitAssistantProposalResponse,
  context: VisitAssistantSemanticContext
): { ok: true; value: VisitAssistantProposalResponse } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (value.baseRevision !== context.snapshot.revision) errors.push('baseRevision does not match the snapshot revision');
  if (value.messages.length > 4 || value.operations.length > 20 || value.clarifications.length > 5
    || value.unresolvedFields.length > 10) errors.push('response exceeds collection limits');
  if (value.operations.length === 0
    && (value.clarifications.length !== 1 || value.unresolvedFields.length !== 1)) {
    errors.push('a no-operation response must contain exactly one clarification and one unresolved field');
  }

  const messageIds = new Set([...context.snapshot.messages.map((m) => m.id), context.userMessageId]);
  const measurementKeys = new Set(context.measurementTemplates.map((m) => m.measurementKey));
  const issueRefs = new Set(context.snapshot.draft.issues.map((i) => i.ref));
  const groups = new Map(context.snapshot.draft.recommendationGroups.map((g) => [g.ref, g]));
  const monitoringRefs = new Set(context.snapshot.draft.monitoring.map((m) => m.ref));
  const recommendationRefs = new Set([
    ...context.snapshot.draft.followUps.map((f) => f.recommendationRef),
    ...context.snapshot.draft.recommendationGroups.flatMap((g) => g.materials.map((m) => m.ref)),
  ]);

  const canonicalIssues = new Map(context.issueMaster.map((item) => [canonicalKey(item.issueName), item]));
  const normalized = structuredClone(value);
  for (const operation of normalized.operations) {
    if (operation.kind === 'measurement.set' && !measurementKeys.has(operation.key)) {
      errors.push(`unknown measurement key: ${operation.key}`);
    }
    if (operation.kind === 'issue.update' && !issueRefs.has(operation.issueRef)) errors.push(`unknown issueRef: ${operation.issueRef}`);
    if (operation.kind === 'recommendation.group.update' && !groups.has(operation.groupRef)) errors.push(`unknown groupRef: ${operation.groupRef}`);
    if (operation.kind === 'recommendation.material.add') {
      if (!groups.has(operation.groupRef)) errors.push(`unknown groupRef: ${operation.groupRef}`);
      if (!issueRefs.has(operation.material.issueRef)) errors.push(`unknown issueRef: ${operation.material.issueRef}`);
    }
    if (operation.kind === 'recommendation.material.update') {
      const group = groups.get(operation.groupRef);
      if (!group) errors.push(`unknown groupRef: ${operation.groupRef}`);
      else if (!group.materials.some((m) => m.ref === operation.materialRef)) errors.push(`unknown materialRef: ${operation.materialRef}`);
    }
    if (operation.kind === 'monitoring.add' && !issueRefs.has(operation.item.issueRef)) errors.push(`unknown issueRef: ${operation.item.issueRef}`);
    if (operation.kind === 'monitoring.update' && !monitoringRefs.has(operation.monitoringRef)) errors.push(`unknown monitoringRef: ${operation.monitoringRef}`);
    if (operation.kind === 'follow_up.set' && !recommendationRefs.has(operation.recommendationRef)) {
      errors.push(`unknown recommendationRef: ${operation.recommendationRef}`);
    }

    const issueFields = operation.kind === 'issue.add' ? operation.issue
      : operation.kind === 'issue.update' ? operation.changes : undefined;
    if (issueFields?.issueName) {
      const match = canonicalIssues.get(canonicalKey(issueFields.issueName.value));
      if (match) {
        issueFields.issueName.value = match.issueName;
        if (issueFields.category) issueFields.category.value = match.category as typeof issueFields.category.value;
      }
    }

    for (const proposed of proposalContainers(operation)) {
      const evidenceItems = proposed.evidence;
      if (!Array.isArray(evidenceItems) || evidenceItems.length > 8) {
        errors.push(`invalid evidence count on operation ${operation.id}`);
        continue;
      }
      for (const item of evidenceItems) {
        if (!item || typeof item !== 'object') continue;
        const ev = item as Record<string, unknown>;
        if (ev.kind === 'message' && !messageIds.has(String(ev.messageId))) errors.push(`unknown message evidence: ${String(ev.messageId)}`);
        if (ev.kind === 'measurement' && !measurementKeys.has(String(ev.key))) errors.push(`unknown measurement evidence: ${String(ev.key)}`);
        if (ev.kind === 'issue' && !issueRefs.has(String(ev.issueRef))) errors.push(`unknown issue evidence: ${String(ev.issueRef)}`);
        if (ev.kind === 'farmer_history' && !context.snapshot.history.some((h) => h.ref === ev.recordRef)) {
          errors.push(`unknown history evidence: ${String(ev.recordRef)}`);
        }
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: normalized };
}

export function buildVisitAssistantFallback(
  snapshot: VisitAssistantSnapshot,
  target: 'field_note' | 'issue' = 'field_note'
): VisitAssistantProposalResponse {
  const fieldTarget = { kind: target } as const;
  return {
    contractVersion: VISIT_ASSISTANT_CONTRACT_VERSION,
    proposalId: randomUUID(),
    baseRevision: snapshot.revision,
    messages: [{
      id: randomUUID(),
      role: 'assistant',
      content: 'I could not safely extract visit updates. Please provide the specific field observation or value.',
      createdAt: new Date().toISOString(),
    }],
    operations: [],
    clarifications: [{ id: randomUUID(), question: 'What exact observation or value should I record?', target: fieldTarget, required: true }],
    unresolvedFields: [{ target: fieldTarget, reason: 'missing_information', detail: 'No safe structured update could be produced.' }],
  };
}

export const visitAssistantService = {
  async extract(input: {
    farmerId: string;
    blockId: string;
    sessionId?: string;
    snapshot: VisitAssistantSnapshot;
    message: { id: string; content: string; createdAt: string };
  }): Promise<VisitAssistantProposalResponse> {
    const block = await blockService.getById(input.blockId, input.farmerId);
    if (!block) throw new NotFoundError('Block not found');
    const [issueMaster, measurementTemplates] = await Promise.all([
      fieldFindingsMastersService.listIssueMaster({ cropType: block.crop_type, limit: 200 }),
      fieldFindingsMastersService.listMeasurementTemplates(block.crop_type),
    ]);
    const context = { snapshot: input.snapshot, userMessageId: input.message.id, issueMaster, measurementTemplates };
    const boundedSnapshot = {
      ...input.snapshot,
      messages: input.snapshot.messages.slice(-30),
      history: input.snapshot.history.slice(-20),
    };
    const systemPrompt = [
      'Extract only explicit agronomist-provided visit facts into visit-assistant/v1 operations.',
      'Never guess. If information is ambiguous or insufficient, emit no operation and exactly one clarification plus one unresolved field.',
      'Use only supplied canonical measurement keys and existing refs for updates. Historical context is read-only.',
      'Every proposed fact needs evidence. Prefer the current message ID.',
      'Do not diagnose or recommend treatment without explicit evidence.',
    ].join(' ');
    const userPrompt = JSON.stringify({
      crop: { cropType: block.crop_type, stage: block.stage, dap: block.dap },
      canonicalIssues: issueMaster.map((i) => ({
        category: i.category.slice(0, 80),
        issueName: i.issueName.slice(0, 300),
      })).slice(0, 200),
      measurementTemplates: measurementTemplates.map((m) => ({
        key: m.measurementKey.slice(0, 200),
        label: m.labelEn.slice(0, 300),
        unit: m.unit?.slice(0, 80) ?? null,
      })).slice(0, 100),
      snapshotJson: JSON.stringify(boundedSnapshot).slice(0, 60_000),
      currentMessage: { ...input.message, role: 'agronomist' },
    });

    try {
      return await openaiStrictJsonSchemaCompletion({
        schemaName: 'visit_assistant_proposal_v1',
        schema: VISIT_ASSISTANT_RESPONSE_SCHEMA,
        systemPrompt,
        userPrompt,
        validate(candidate) {
          const contract = validateVisitAssistantProposalResponse(candidate);
          if (!contract.ok) return contract;
          return normalizeVisitAssistantProposal(contract.value, context);
        },
      });
    } catch (error) {
      logger.warn({ err: error, blockId: input.blockId }, 'Visit assistant extraction unavailable');
      return buildVisitAssistantFallback(input.snapshot);
    }
  },
};
