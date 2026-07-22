import {
  validateVisitAssistantProposalResponse,
  type VisitAssistantProposalResponse,
  type VisitAssistantSnapshot,
} from '@morbeez/shared/visit-assistant';
import type {
  VisitCopilotEvidenceItem,
  VisitCopilotStructuredPreview,
  VisitCopilotTreatmentDraft,
  VisitCopilotValidation,
  VisitCopilotValidationItem,
  VisitCopilotReminder,
} from '@morbeez/shared/visit-copilot';
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { fieldFindingsMastersService } from '../admin/field-findings-masters.service.js';
import { blockService } from '../core/block.service.js';
import { openaiStrictJsonSchemaCompletion } from '../ai/providers/openai.provider.js';
import {
  VISIT_ASSISTANT_RESPONSE_SCHEMA,
  buildVisitAssistantFallback,
  normalizeVisitAssistantProposal,
  type VisitAssistantSemanticContext,
} from './visit-assistant.service.js';

const text = (maxLength = 2_000) => ({ type: 'string', minLength: 1, maxLength });
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const stringArray = { type: 'array' as const, maxItems: 12, items: text(500) };

export const VISIT_COPILOT_EXTRACTION_SCHEMA = object({
  assistantMessage: text(4_000),
  workflow: object({
    workingDiagnosis: text(500),
    diagnosisStatus: { type: 'string', enum: ['pending_confirmation', 'suspected', 'confirmed'] },
    confidence: { type: ['number', 'null'] },
    evidenceRequired: { type: 'array', maxItems: 12, items: text(300) },
    evidenceReceived: {
      type: 'array',
      maxItems: 12,
      items: object({
        label: text(300),
        present: { type: 'boolean' },
      }),
    },
    farmerQuestions: stringArray,
    treatmentActivities: {
      type: 'array',
      maxItems: 8,
      items: object({
        method: text(200),
        product: text(300),
        dose: text(300),
        intervalDays: { type: ['integer', 'null'], minimum: 0, maximum: 365 },
        repeatCount: { type: ['integer', 'null'], minimum: 0, maximum: 24 },
        notes: { type: ['string', 'null'], maxLength: 1_000 },
      }),
    },
    farmerAdvice: stringArray,
    weatherAdvisory: stringArray,
    reminders: {
      type: 'array',
      maxItems: 12,
      items: object({
        dayOffset: { type: 'integer', minimum: 0, maximum: 365 },
        label: text(400),
      }),
    },
    validation: object({
      compatibility: stringArray,
      weather: stringArray,
      followUp: stringArray,
    }),
  }),
  proposal: VISIT_ASSISTANT_RESPONSE_SCHEMA,
});

export type VisitCopilotExtractionResult = {
  assistantMessage: string;
  preview: VisitCopilotStructuredPreview;
  farmerQuestions: string[];
  treatment: VisitCopilotTreatmentDraft;
  reminders: VisitCopilotReminder[];
  validation: VisitCopilotValidation;
  proposal: VisitAssistantProposalResponse;
};

function mapValidation(lines: string[]): VisitCopilotValidationItem[] {
  return lines.map((line) => ({
    text: line,
    status: /check|verify|incompatible|before recommending/i.test(line) ? 'warning' as const : 'ok' as const,
  }));
}

function buildPreview(workflow: Record<string, unknown>): VisitCopilotStructuredPreview {
  const evidenceRequired: VisitCopilotEvidenceItem[] = Array.isArray(workflow.evidenceRequired)
    ? workflow.evidenceRequired.map((label) => ({
        label: String(label),
        status: 'pending' as const,
      }))
    : [];
  const evidenceReceived = Array.isArray(workflow.evidenceReceived)
    ? workflow.evidenceReceived.map((row) => {
        const item = row as Record<string, unknown>;
        return { label: String(item.label ?? ''), present: Boolean(item.present) };
      })
    : [];

  for (const received of evidenceReceived) {
    const match = evidenceRequired.find(
      (item) => item.label.toLowerCase() === received.label.toLowerCase()
    );
    if (match) {
      match.status = received.present ? 'received' : 'not_observed';
    } else {
      evidenceRequired.push({
        label: received.label,
        status: received.present ? 'received' : 'not_observed',
      });
    }
  }

  return {
    workingDiagnosis: String(workflow.workingDiagnosis ?? ''),
    diagnosisStatus: (workflow.diagnosisStatus as VisitCopilotStructuredPreview['diagnosisStatus']) ?? 'pending_confirmation',
    confidence: typeof workflow.confidence === 'number' ? workflow.confidence : null,
    evidenceRequired,
    evidenceReceived,
  };
}

export const visitCopilotExtractionService = {
  async extract(input: {
    farmerId: string;
    blockId: string;
    snapshot: VisitAssistantSnapshot;
    message: { id: string; content: string; createdAt: string };
    priorEvidenceReceived?: Array<{ label: string; present: boolean }>;
  }): Promise<VisitCopilotExtractionResult> {
    const block = await blockService.getById(input.blockId, input.farmerId);
    if (!block) throw new NotFoundError('Block not found');

    const [issueMaster, measurementTemplates] = await Promise.all([
      fieldFindingsMastersService.listIssueMaster({ cropType: block.crop_type, limit: 200 }),
      fieldFindingsMastersService.listMeasurementTemplates(block.crop_type),
    ]);

    const context: VisitAssistantSemanticContext = {
      snapshot: input.snapshot,
      userMessageId: input.message.id,
      issueMaster,
      measurementTemplates,
    };

    const boundedSnapshot = {
      ...input.snapshot,
      messages: input.snapshot.messages.slice(-30),
      history: input.snapshot.history.slice(-20),
    };

    const systemPrompt = [
      'You are the Agronomist Visit Copilot. Convert clinical agronomist instructions into structured visit-wizard data.',
      'Emit visit-assistant/v1 operations that map to the 12-page visit form: issues (diagnosis), recommendations (treatment), monitoring (follow-up), field notes.',
      'Also emit workflow metadata: working diagnosis, evidence checklist, farmer questions, treatment draft, reminders, and validation notes.',
      'When the agronomist describes a suspected diagnosis, add an issue with finalDiagnosis or issueName and status monitoring/open.',
      'When treatment is specified (product, dose, interval, repeat count), add recommendation.group.add and recommendation.material.add with drenching/soil_application as appropriate.',
      'When monitoring intervals are mentioned, add monitoring.add operations.',
      'Farmer questions should be simple, actionable, and numbered in workflow.farmerQuestions.',
      'Reminders should use dayOffset from today (e.g. 3, 7, 14, 21).',
      'Every proposed operation field needs evidence referencing the current message id.',
      'assistantMessage should summarize what you extracted in clear prose for the agronomist chat.',
    ].join(' ');

    const userPrompt = JSON.stringify({
      crop: { cropType: block.crop_type, stage: block.stage, dap: block.dap },
      canonicalIssues: issueMaster.map((i) => ({
        category: i.category,
        issueName: i.issueName,
      })).slice(0, 200),
      measurementTemplates: measurementTemplates.map((m) => ({
        key: m.measurementKey,
        label: m.labelEn,
      })).slice(0, 100),
      priorEvidenceReceived: input.priorEvidenceReceived ?? [],
      snapshotJson: JSON.stringify(boundedSnapshot).slice(0, 55_000),
      currentMessage: { ...input.message, role: 'agronomist' },
    });

    try {
      const extracted = await openaiStrictJsonSchemaCompletion({
        schemaName: 'visit_copilot_extraction_v1',
        schema: VISIT_COPILOT_EXTRACTION_SCHEMA,
        systemPrompt,
        userPrompt,
        validate(candidate) {
          if (!candidate || typeof candidate !== 'object') {
            return { ok: false, errors: ['not an object'] };
          }
          const row = candidate as Record<string, unknown>;
          const proposal = row.proposal;
          const contract = validateVisitAssistantProposalResponse(proposal);
          if (!contract.ok) return contract;
          const normalized = normalizeVisitAssistantProposal(contract.value, context);
          if (!normalized.ok) return normalized;
          return { ok: true, value: { ...row, proposal: normalized.value } };
        },
        maxTokens: 6_000,
      }) as Record<string, unknown> & { proposal: VisitAssistantProposalResponse };

      const workflow = extracted.workflow as Record<string, unknown>;
      const validationRaw = (workflow.validation ?? {}) as Record<string, unknown>;

      return {
        assistantMessage: String(extracted.assistantMessage ?? ''),
        preview: buildPreview(workflow),
        farmerQuestions: Array.isArray(workflow.farmerQuestions)
          ? workflow.farmerQuestions.map(String)
          : [],
        treatment: {
          activities: Array.isArray(workflow.treatmentActivities)
            ? workflow.treatmentActivities.map((row) => {
                const item = row as Record<string, unknown>;
                return {
                  method: String(item.method ?? ''),
                  product: String(item.product ?? ''),
                  dose: String(item.dose ?? ''),
                  intervalDays: typeof item.intervalDays === 'number' ? item.intervalDays : null,
                  repeatCount: typeof item.repeatCount === 'number' ? item.repeatCount : null,
                  notes: typeof item.notes === 'string' ? item.notes : null,
                };
              })
            : [],
          farmerAdvice: Array.isArray(workflow.farmerAdvice)
            ? workflow.farmerAdvice.map(String)
            : [],
          weatherAdvisory: Array.isArray(workflow.weatherAdvisory)
            ? workflow.weatherAdvisory.map(String)
            : [],
        },
        reminders: Array.isArray(workflow.reminders)
          ? workflow.reminders.map((row) => {
              const item = row as Record<string, unknown>;
              return {
                dayOffset: Number(item.dayOffset ?? 0),
                label: String(item.label ?? ''),
              };
            })
          : [],
        validation: {
          compatibility: mapValidation(
            Array.isArray(validationRaw.compatibility) ? validationRaw.compatibility.map(String) : []
          ),
          weather: mapValidation(
            Array.isArray(validationRaw.weather) ? validationRaw.weather.map(String) : []
          ),
          followUp: mapValidation(
            Array.isArray(validationRaw.followUp) ? validationRaw.followUp.map(String) : []
          ),
        },
        proposal: extracted.proposal,
      };
    } catch (error) {
      logger.warn({ err: error, blockId: input.blockId }, 'Visit copilot extraction unavailable');
      const fallback = buildVisitAssistantFallback(input.snapshot, 'issue');
      return {
        assistantMessage:
          'I could not fully structure that instruction. Please try again with diagnosis, evidence to collect, treatment dose, and monitoring interval.',
        preview: {
          workingDiagnosis: '',
          diagnosisStatus: 'pending_confirmation',
          confidence: null,
          evidenceRequired: [],
          evidenceReceived: [],
        },
        farmerQuestions: [],
        treatment: { activities: [], farmerAdvice: [], weatherAdvisory: [] },
        reminders: [],
        validation: { compatibility: [], weather: [], followUp: [] },
        proposal: fallback,
      };
    }
  },
};
