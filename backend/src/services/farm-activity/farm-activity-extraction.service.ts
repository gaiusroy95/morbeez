import { randomUUID } from 'node:crypto';
import {
  FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
  mergeFarmActivityAssistantDrafts,
  validateFarmActivityAssistantDraft,
  type FarmActivityAssistantClarification,
  type FarmActivityAssistantDraftV1,
  type FarmActivityAssistantField,
  type FarmActivityAssistantSource,
  type FarmActivityAssistantSourceMedia,
  type FarmActivityAssistantSubEvent,
  type FarmActivityAssistantTranscriptSegment,
  type FarmActivityAssistantUnit,
} from '@morbeez/shared/farm-activity-assistant';
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { openaiStrictJsonSchemaCompletion } from '../ai/providers/openai.provider.js';
import { blockDisplayName, blockService } from '../core/block.service.js';
import { farmActivityDraftService } from './farm-activity-draft.service.js';
import { detectFarmActivityLanguage } from './farm-activity-language.service.js';
import { loadFarmActivityTerminologyExpansion } from './farm-activity-terminology.service.js';

type ExtractionPayload = {
  subEvents: FarmActivityAssistantSubEvent[];
  clarifications: FarmActivityAssistantClarification[];
};

const text = (maxLength = 2_000) => ({ type: 'string', minLength: 1, maxLength });
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const enumString = (values: readonly string[]) => ({ type: 'string', enum: values });
const provenance = {
  type: 'array',
  minItems: 1,
  maxItems: 4,
  items: enumString([
    'explicit_text', 'voice_transcript', 'source_media', 'conversation_context',
    'assistant_inference', 'user_edit',
  ]),
};
const sourceRefs = { type: 'array', maxItems: 8, items: text(200) };
const unresolved = object({
  reason: enumString(['missing', 'ambiguous', 'conflicting', 'unsupported']),
  detail: text(500),
});
const field = (value: unknown) => ({
  anyOf: [
    object({
      value,
      confidence: enumString(['low', 'medium', 'high']),
      provenance,
      sourceRefs,
    }),
    object({
      value: { type: 'null' },
      confidence: { const: 'low' },
      provenance,
      sourceRefs,
      unresolved,
    }),
  ],
});
const stringField = field(text());
const numberField = field({ type: 'number', minimum: 0 });
const dateField = field(text(32));
const unitField = field(enumString([
  'kg', 'g', 'litre', 'ml', 'quintal', 'tonne', 'bag', 'piece', 'hour', 'day', 'acre', 'other',
]));
const moneyField = field(object({ amount: { type: 'number', minimum: 0 }, currency: { const: 'INR' } }));
const base = {
  id: text(200),
  sequence: { type: 'integer', minimum: 0 },
  sourceRefs,
};

const subEventSchemas = [
  object({
    ...base, kind: { const: 'activity' }, occurredOn: dateField, activityType: stringField,
    blockRef: stringField, description: stringField, quantity: numberField, unit: unitField,
  }),
  object({
    ...base, kind: { const: 'labour' }, occurredOn: dateField, workType: stringField,
    workerCount: numberField, durationHours: numberField, rate: moneyField, totalCost: moneyField,
  }),
  object({
    ...base, kind: { const: 'purchase' }, occurredOn: dateField, itemName: stringField,
    vendorName: stringField, quantity: numberField, unit: unitField, unitPrice: moneyField,
    totalCost: moneyField,
  }),
  object({
    ...base, kind: { const: 'expense' }, occurredOn: dateField, category: stringField,
    description: stringField, amount: moneyField, paidTo: stringField,
  }),
  object({
    ...base, kind: { const: 'harvest' }, occurredOn: dateField, cropName: stringField,
    blockRef: stringField, quantity: numberField, unit: unitField, grade: stringField,
    buyerName: stringField, saleAmount: moneyField,
  }),
  object({
    ...base, kind: { const: 'inventory_movement' }, occurredOn: dateField,
    movementType: field(enumString(['stock_in', 'stock_out', 'transfer', 'adjustment'])),
    itemName: stringField, quantity: numberField, unit: unitField, fromLocation: stringField,
    toLocation: stringField,
  }),
];

export const FARM_ACTIVITY_EXTRACTION_SCHEMA = object({
  subEvents: { type: 'array', maxItems: 12, items: { anyOf: subEventSchemas } },
  clarifications: {
    type: 'array',
    maxItems: 1,
    items: object({
      id: text(200),
      question: text(1_000),
      subEventId: text(200),
      field: text(100),
      required: { type: 'boolean' },
      options: { type: 'array', maxItems: 6, items: text(200) },
    }),
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function collectFields(event: FarmActivityAssistantSubEvent): Array<[string, FarmActivityAssistantField<unknown>]> {
  return Object.entries(event)
    .filter(([key, value]) =>
      !['id', 'kind', 'sequence', 'sourceRefs'].includes(key) && isRecord(value) && 'value' in value)
    .map(([key, value]) => [key, value as FarmActivityAssistantField<unknown>]);
}

function descriptorFor(event: FarmActivityAssistantSubEvent): string {
  if (event.kind === 'activity') return String(event.activityType.value ?? '');
  if (event.kind === 'labour') return String(event.workType.value ?? '');
  if (event.kind === 'purchase' || event.kind === 'inventory_movement') return String(event.itemName.value ?? '');
  if (event.kind === 'expense') return String(event.category.value ?? '');
  return String(event.cropName.value ?? '');
}

function eventIdentity(event: FarmActivityAssistantSubEvent): string {
  return `${event.kind}|${event.occurredOn.value ?? ''}|${descriptorFor(event).trim().toLowerCase()}`;
}

/** Drops exact duplicate newly extracted events while keeping independent clear ones. */
export function dedupeIndependentSubEvents(
  events: FarmActivityAssistantSubEvent[]
): FarmActivityAssistantSubEvent[] {
  const seen = new Set<string>();
  const unique: FarmActivityAssistantSubEvent[] = [];
  for (const event of events) {
    const key = `${event.id}|${eventIdentity(event)}`;
    if (seen.has(key) || seen.has(eventIdentity(event))) continue;
    seen.add(key);
    seen.add(eventIdentity(event));
    unique.push(event);
  }
  return unique.map((event, index) => ({ ...event, sequence: index + 1 }));
}

export function validateFarmActivityExtraction(
  value: unknown,
  context: { sourceRefs: Set<string>; blockRefs: Set<string>; clarificationAttempts: number }
): { ok: true; value: ExtractionPayload } | { ok: false; errors: string[] } {
  if (!isRecord(value) || !Array.isArray(value.subEvents) || !Array.isArray(value.clarifications)) {
    return { ok: false, errors: ['response must contain subEvents and clarifications arrays'] };
  }
  const candidate = value as unknown as ExtractionPayload;
  const errors: string[] = [];
  if (candidate.subEvents.length > 12) errors.push('too many sub-events');
  if (candidate.clarifications.length > 1) errors.push('ask only one clarification at a time');
  if (context.clarificationAttempts >= 2 && candidate.clarifications.length) {
    errors.push('maximum clarification attempts reached');
  }

  const ids = new Set<string>();
  for (const event of candidate.subEvents) {
    if (!isRecord(event) || typeof event.id !== 'string' || typeof event.kind !== 'string') {
      errors.push('invalid sub-event');
      continue;
    }
    if (ids.has(event.id)) errors.push(`duplicate sub-event id: ${event.id}`);
    ids.add(event.id);
    for (const ref of event.sourceRefs ?? []) {
      if (!context.sourceRefs.has(ref)) errors.push(`unknown source reference: ${ref}`);
    }
    for (const [name, extracted] of collectFields(event)) {
      for (const ref of extracted.sourceRefs ?? []) {
        if (!context.sourceRefs.has(ref)) errors.push(`unknown ${name} source reference: ${ref}`);
      }
      if (extracted.value !== null && extracted.sourceRefs.length === 0) {
        errors.push(`${name} has no source evidence`);
      }
      if (name === 'blockRef' && extracted.value !== null
        && !context.blockRefs.has(String(extracted.value).trim().toLowerCase())) {
        errors.push(`unknown blockRef: ${String(extracted.value)}`);
      }
      if (extracted.value !== null && (
        name === 'quantity'
        || name === 'unit'
        || name === 'rate'
        || name === 'unitPrice'
        || name === 'totalCost'
        || name === 'amount'
        || name === 'saleAmount'
        || name === 'itemName'
      ) && !extracted.provenance.some((item) =>
        item === 'explicit_text' || item === 'voice_transcript' || item === 'source_media' || item === 'user_edit')) {
        errors.push(`${name} cannot be invented from context alone`);
      }
    }
  }
  for (const clarification of candidate.clarifications) {
    if (!ids.has(clarification.subEventId)) {
      errors.push(`clarification references unknown sub-event: ${clarification.subEventId}`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: candidate };
}

function unresolvedField<T = string>(
  reason: 'missing' | 'ambiguous',
  detail: string,
  refs: string[]
): FarmActivityAssistantField<T> {
  return {
    value: null,
    confidence: 'low',
    provenance: ['assistant_inference'],
    sourceRefs: refs,
    unresolved: { reason, detail },
  };
}

function buildFallbackDraft(input: {
  draftId: string;
  revision: number;
  source: FarmActivityAssistantSource;
  language: string;
  clarificationAttempts: number;
  sourceText: string;
}): FarmActivityAssistantDraftV1 {
  const eventId = randomUUID();
  const refs = [input.source.messageId];
  const questions: Record<string, string> = {
    ml: 'രേഖപ്പെടുത്തേണ്ട കാർഷിക പ്രവർത്തനം കൃത്യമായി പറയാമോ?',
    ta: 'பதிவு செய்ய வேண்டிய பண்ணை செயலைத் தெளிவாகச் சொல்ல முடியுமா?',
    kn: 'ದಾಖಲಿಸಬೇಕಾದ ಕೃಷಿ ಚಟುವಟಿಕೆಯನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಬಹುದೇ?',
    hi: 'कृपया दर्ज की जाने वाली खेती की गतिविधि स्पष्ट बताएँ।',
    en: 'What exact farm activity should I record?',
  };
  const clarifications: FarmActivityAssistantClarification[] =
    input.clarificationAttempts < 2 && input.sourceText
      ? [{
        id: randomUUID(),
        question: questions[input.language] ?? questions.en!,
        subEventId: eventId,
        field: 'activityType',
        required: true,
      }]
      : [];

  return {
    contractVersion: FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
    draftId: input.draftId,
    revision: input.revision,
    source: input.source,
    subEvents: [{
      id: eventId,
      kind: 'activity',
      sequence: 1,
      sourceRefs: refs,
      occurredOn: unresolvedField('missing', 'Activity date was not clear.', refs),
      activityType: unresolvedField('missing', 'Activity type was not safely extractable.', refs),
      blockRef: unresolvedField('missing', 'Plot/block was not stated.', refs),
      description: unresolvedField('missing', 'No safe description could be produced.', refs),
      quantity: unresolvedField<number>('missing', 'Quantity/dose was not stated.', refs),
      unit: unresolvedField<FarmActivityAssistantUnit>('missing', 'Unit was not stated.', refs),
    }],
    clarifications,
  };
}

export type FarmActivityExtractionInput = {
  farmerId: string;
  blockId?: string;
  messageId: string;
  channel: FarmActivityAssistantSource['channel'];
  text?: string;
  transcript?: FarmActivityAssistantTranscriptSegment[];
  media?: FarmActivityAssistantSourceMedia[];
  season?: string | null;
  existingDraft?: FarmActivityAssistantDraftV1;
  clarificationAttempts?: number;
  conversationSessionId?: string | null;
  persist?: boolean;
};

export const farmActivityExtractionService = {
  async extract(input: FarmActivityExtractionInput): Promise<FarmActivityAssistantDraftV1> {
    const transcript = input.transcript ?? [];
    const finalTranscript = transcript.map((segment) => segment.text).join(' ').trim();
    const sourceText = [input.text?.trim(), finalTranscript].filter(Boolean).join('\n');
    const [{ data: farmer }, blocks] = await Promise.all([
      supabase.from('farmers').select('preferred_language, district').eq('id', input.farmerId).maybeSingle(),
      blockService.listByFarmer(input.farmerId),
    ]);
    if (input.blockId && !blocks.some((block) => block.id === input.blockId)) {
      throw new NotFoundError('Block not found');
    }

    const preferredLanguage = farmer?.preferred_language ? String(farmer.preferred_language) : null;
    const language = detectFarmActivityLanguage(finalTranscript || input.text || '', preferredLanguage);
    const terminology = await loadFarmActivityTerminologyExpansion({
      farmerId: input.farmerId,
      languageHint: language.detectedLanguage,
    });

    const source: FarmActivityAssistantSource = {
      messageId: input.messageId,
      channel: input.channel,
      ...(input.text ? { text: input.text } : {}),
      language: {
        code: language.detectedLanguage,
        detected: true,
        confidence: finalTranscript || input.text ? 'high' : 'low',
      },
      media: input.media ?? [],
      transcript,
    };
    const sourceRefs = new Set([
      input.messageId,
      ...transcript.map((segment) => segment.id),
      ...(input.media ?? []).map((item) => item.id),
    ]);
    const blockRefs = new Set(blocks.flatMap((block) =>
      [block.id, block.name, block.plot_label, blockDisplayName(block)]
        .filter((item): item is string => Boolean(item))
        .map((item) => item.trim().toLowerCase())));
    const clarificationAttempts = input.clarificationAttempts ?? 0;
    const draftId = input.existingDraft?.draftId ?? randomUUID();
    const revision = (input.existingDraft?.revision ?? 0) + 1;

    const promptContext = {
      today: new Date().toISOString().slice(0, 10),
      language,
      storedLanguageHint: preferredLanguage,
      farmer: { id: input.farmerId, district: farmer?.district ?? null },
      selectedBlockId: input.blockId ?? null,
      blocks: blocks.map((block) => ({
        id: block.id,
        name: blockDisplayName(block),
        crop: block.crop_type,
        stage: block.stage,
        dap: block.dap,
        plantingDate: block.planting_date,
      })),
      season: input.season ?? null,
      terminologyExpansion: terminology,
      source,
      sourceText,
      existingSubEvents: input.existingDraft?.subEvents ?? [],
      clarificationAttempt: clarificationAttempts + 1,
      maxClarificationAttempts: 2,
    };
    const systemPrompt = [
      'Extract farm records from code-mixed English, Malayalam, Tamil, Kannada, or Hindi into farm-activity-assistant/v1 sub-events.',
      'Return every independent clear activity, labour, purchase, expense, harvest, and inventory movement as its own sub-event.',
      'Use farmer, block, crop-stage, and season context only to resolve explicit references; context is not evidence that an event occurred.',
      'Expand regional terminology and aliases using terminologyExpansion when the spoken/written form matches; keep sourceRefs on the original transcript/text.',
      'Every field needs its own confidence, provenance array, and sourceRefs. Use voice_transcript for transcript facts and explicit_text for message facts.',
      'Never invent or infer a plot/block, product or item identity, dose/quantity, price, rate, or cost. Make that field null and unresolved when absent or ambiguous.',
      'Do not calculate cost unless both the calculation and all operands are explicit. Dates such as today/yesterday may be resolved using supplied today.',
      'Ask at most one short clarification, for the single most important unresolved field. Never ask after clarification attempt two.',
      'Do not collapse independent events into one and do not repeat events already present in existingSubEvents.',
    ].join(' ');

    let draft: FarmActivityAssistantDraftV1;
    try {
      const extracted = await openaiStrictJsonSchemaCompletion({
        schemaName: 'farm_activity_extraction_v1',
        schema: FARM_ACTIVITY_EXTRACTION_SCHEMA,
        systemPrompt,
        userPrompt: JSON.stringify(promptContext).slice(0, 60_000),
        validate: (value) => {
          const extraction = validateFarmActivityExtraction(value, {
            sourceRefs,
            blockRefs,
            clarificationAttempts,
          });
          if (!extraction.ok) return extraction;
          const candidate: FarmActivityAssistantDraftV1 = {
            contractVersion: FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
            draftId,
            revision,
            source,
            subEvents: dedupeIndependentSubEvents(extraction.value.subEvents),
            clarifications: extraction.value.clarifications.slice(0, 1),
          };
          const contract = validateFarmActivityAssistantDraft(candidate);
          if (!contract.ok) {
            return { ok: false, errors: contract.errors.map((item) => `${item.path}: ${item.message}`) };
          }
          return { ok: true, value: contract.value };
        },
        maxTokens: 4_000,
      });
      draft = extracted;
    } catch (error) {
      logger.warn({ err: error, farmerId: input.farmerId }, 'Farm activity extraction unavailable');
      draft = buildFallbackDraft({
        draftId,
        revision,
        source,
        language: language.detectedLanguage,
        clarificationAttempts,
        sourceText,
      });
    }

    if (input.existingDraft) {
      draft = mergeFarmActivityAssistantDrafts(input.existingDraft, {
        ...draft,
        clarifications: draft.clarifications.slice(0, 1),
      });
      draft = {
        ...draft,
        clarifications: draft.clarifications.slice(0, 1),
        revision,
        source,
      };
    }

    if (input.persist !== false) {
      await farmActivityDraftService.persistExtraction({
        farmerId: input.farmerId,
        conversationSessionId: input.conversationSessionId ?? null,
        preferredLanguageHint: preferredLanguage,
        detectedLanguage: language.detectedLanguage,
        codeMixed: language.codeMixed,
        clarificationAttempts: clarificationAttempts + (draft.clarifications.length ? 1 : 0),
        draft,
        transcript: finalTranscript || input.text || null,
      });
    }

    return draft;
  },
};
