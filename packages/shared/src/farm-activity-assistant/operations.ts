import {
  FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
  type FarmActivityAssistantAction,
  type FarmActivityAssistantDraftV1,
  type FarmActivityAssistantField,
  type FarmActivityAssistantSource,
  type FarmActivityAssistantSubEvent,
  type FarmActivityAssistantValidationError,
  type FarmActivityAssistantValidationResult,
} from './v1.js';

const CONFIDENCE = ['low', 'medium', 'high'] as const;
const PROVENANCE = [
  'explicit_text',
  'voice_transcript',
  'source_media',
  'conversation_context',
  'assistant_inference',
  'user_edit',
] as const;
const UNRESOLVED_REASON = ['missing', 'ambiguous', 'conflicting', 'unsupported'] as const;
const UNITS = [
  'kg', 'g', 'litre', 'ml', 'quintal', 'tonne', 'bag', 'piece',
  'hour', 'day', 'acre', 'other',
] as const;

const EVENT_FIELDS = {
  activity: ['occurredOn', 'activityType', 'blockRef', 'description', 'quantity', 'unit'],
  labour: ['occurredOn', 'workType', 'workerCount', 'durationHours', 'rate', 'totalCost'],
  purchase: ['occurredOn', 'itemName', 'vendorName', 'quantity', 'unit', 'unitPrice', 'totalCost'],
  expense: ['occurredOn', 'category', 'description', 'amount', 'paidTo'],
  harvest: [
    'occurredOn', 'cropName', 'blockRef', 'quantity', 'unit', 'grade', 'buyerName', 'saleAmount',
  ],
  inventory_movement: [
    'occurredOn', 'movementType', 'itemName', 'quantity', 'unit', 'fromLocation', 'toLocation',
  ],
} as const;

type ObjectValue = Record<string, unknown>;
type ValueValidator = (value: unknown) => boolean;

function isObject(value: unknown): value is ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEnum<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function isSafeText(value: unknown, max = 10_000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isSafeId(value: unknown): value is string {
  return isSafeText(value, 200)
    && !['__proto__', 'prototype', 'constructor'].includes(value);
}

function hasExactKeys(
  value: ObjectValue,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const keys = Object.keys(value);
  return required.every((key) => key in value)
    && keys.every((key) => required.includes(key) || optional.includes(key));
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

const textValue: ValueValidator = (value) => isSafeText(value);
const numberValue: ValueValidator = (value) => isNonNegativeNumber(value);
const unitValue: ValueValidator = (value) => isEnum(value, UNITS);
const moneyValue: ValueValidator = (value) =>
  isObject(value)
  && hasExactKeys(value, ['amount', 'currency'])
  && isNonNegativeNumber(value.amount)
  && value.currency === 'INR';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isSafeId);
}

function validField<T>(
  value: unknown,
  validValue: ValueValidator
): value is FarmActivityAssistantField<T> {
  if (!isObject(value)
    || !isEnum(value.confidence, CONFIDENCE)
    || !Array.isArray(value.provenance)
    || value.provenance.length === 0
    || !value.provenance.every((item) => isEnum(item, PROVENANCE))
    || !isStringArray(value.sourceRefs)) return false;

  if (value.value === null) {
    return hasExactKeys(
      value,
      ['value', 'confidence', 'provenance', 'sourceRefs', 'unresolved']
    )
      && value.confidence === 'low'
      && isObject(value.unresolved)
      && hasExactKeys(value.unresolved, ['reason', 'detail'])
      && isEnum(value.unresolved.reason, UNRESOLVED_REASON)
      && isSafeText(value.unresolved.detail, 1_000);
  }

  return hasExactKeys(value, ['value', 'confidence', 'provenance', 'sourceRefs'])
    && validValue(value.value);
}

function validatorsFor(kind: FarmActivityAssistantSubEvent['kind']): Record<string, ValueValidator> {
  switch (kind) {
    case 'activity':
      return {
        occurredOn: textValue,
        activityType: textValue,
        blockRef: textValue,
        description: textValue,
        quantity: numberValue,
        unit: unitValue,
      };
    case 'labour':
      return {
        occurredOn: textValue,
        workType: textValue,
        workerCount: numberValue,
        durationHours: numberValue,
        rate: moneyValue,
        totalCost: moneyValue,
      };
    case 'purchase':
      return {
        occurredOn: textValue,
        itemName: textValue,
        vendorName: textValue,
        quantity: numberValue,
        unit: unitValue,
        unitPrice: moneyValue,
        totalCost: moneyValue,
      };
    case 'expense':
      return {
        occurredOn: textValue,
        category: textValue,
        description: textValue,
        amount: moneyValue,
        paidTo: textValue,
      };
    case 'harvest':
      return {
        occurredOn: textValue,
        cropName: textValue,
        blockRef: textValue,
        quantity: numberValue,
        unit: unitValue,
        grade: textValue,
        buyerName: textValue,
        saleAmount: moneyValue,
      };
    case 'inventory_movement':
      return {
        occurredOn: textValue,
        movementType: (value) =>
          isEnum(value, ['stock_in', 'stock_out', 'transfer', 'adjustment'] as const),
        itemName: textValue,
        quantity: numberValue,
        unit: unitValue,
        fromLocation: textValue,
        toLocation: textValue,
      };
  }
}

function validSubEvent(value: unknown): value is FarmActivityAssistantSubEvent {
  if (!isObject(value)
    || !isEnum(value.kind, Object.keys(EVENT_FIELDS) as Array<keyof typeof EVENT_FIELDS>)
    || !isSafeId(value.id)
    || !Number.isSafeInteger(value.sequence)
    || (value.sequence as number) < 0
    || !isStringArray(value.sourceRefs)) return false;

  const fields = EVENT_FIELDS[value.kind];
  if (!hasExactKeys(value, ['id', 'kind', 'sequence', 'sourceRefs', ...fields])) return false;
  const validators = validatorsFor(value.kind);
  return fields.every((field) => validField(value[field], validators[field]!));
}

function validSource(value: unknown): value is FarmActivityAssistantSource {
  if (!isObject(value)
    || !hasExactKeys(value, ['messageId', 'channel', 'language', 'media', 'transcript'], ['text'])
    || !isSafeId(value.messageId)
    || !isEnum(value.channel, ['whatsapp', 'app', 'api'] as const)
    || (value.text !== undefined && !isSafeText(value.text))
    || !isObject(value.language)
    || !hasExactKeys(value.language, ['code', 'detected', 'confidence'])
    || !isSafeText(value.language.code, 35)
    || typeof value.language.detected !== 'boolean'
    || !isEnum(value.language.confidence, CONFIDENCE)
    || !Array.isArray(value.media)
    || !Array.isArray(value.transcript)) return false;

  const mediaValid = value.media.every((item) =>
    isObject(item)
    && hasExactKeys(item, ['id', 'kind', 'mimeType'], ['fileName', 'uri'])
    && isSafeId(item.id)
    && isEnum(item.kind, ['audio', 'image', 'video', 'document'] as const)
    && isSafeText(item.mimeType, 200)
    && (item.fileName === undefined || isSafeText(item.fileName, 500))
    && (item.uri === undefined || isSafeText(item.uri, 2_000)));
  const transcriptValid = value.transcript.every((item) =>
    isObject(item)
    && hasExactKeys(item, ['id', 'text'], ['startMs', 'endMs', 'languageCode', 'mediaRef'])
    && isSafeId(item.id)
    && isSafeText(item.text)
    && (item.startMs === undefined || isNonNegativeNumber(item.startMs))
    && (item.endMs === undefined || isNonNegativeNumber(item.endMs))
    && (item.startMs === undefined || item.endMs === undefined || item.endMs >= item.startMs)
    && (item.languageCode === undefined || isSafeText(item.languageCode, 35))
    && (item.mediaRef === undefined || isSafeId(item.mediaRef)));
  return mediaValid && transcriptValid;
}

function error(path: string, code: string, message: string): FarmActivityAssistantValidationError {
  return { path, code, message };
}

export function validateFarmActivityAssistantDraft(
  value: unknown
): FarmActivityAssistantValidationResult<FarmActivityAssistantDraftV1> {
  if (!isObject(value) || !hasExactKeys(value, [
    'contractVersion', 'draftId', 'revision', 'source', 'subEvents', 'clarifications',
  ])) {
    return {
      ok: false,
      errors: [error('$', 'invalid_shape', 'Draft has missing or unknown top-level fields.')],
    };
  }

  const errors: FarmActivityAssistantValidationError[] = [];
  if (value.contractVersion !== FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION) {
    errors.push(error('contractVersion', 'unsupported_version', 'Unsupported contract version.'));
  }
  if (!isSafeId(value.draftId)) errors.push(error('draftId', 'invalid_id', 'draftId is invalid.'));
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0) {
    errors.push(error('revision', 'invalid_revision', 'revision must be a non-negative integer.'));
  }
  if (!validSource(value.source)) errors.push(error('source', 'invalid_source', 'source is invalid.'));
  if (!Array.isArray(value.subEvents) || !value.subEvents.every(validSubEvent)) {
    errors.push(error('subEvents', 'invalid_sub_events', 'One or more sub-events are invalid.'));
  }

  const subEvents = Array.isArray(value.subEvents) ? value.subEvents.filter(validSubEvent) : [];
  const ids = subEvents.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    errors.push(error('subEvents', 'duplicate_id', 'Sub-event ids must be unique.'));
  }

  const eventById = new Map(subEvents.map((item) => [item.id, item]));
  if (!Array.isArray(value.clarifications) || !value.clarifications.every((item) => {
    if (!isObject(item)
      || !hasExactKeys(item, ['id', 'question', 'subEventId', 'field', 'required'], ['options'])
      || !isSafeId(item.id)
      || !isSafeText(item.question, 1_000)
      || !isSafeId(item.subEventId)
      || !isSafeText(item.field, 100)
      || typeof item.required !== 'boolean'
      || (item.options !== undefined
        && (!Array.isArray(item.options) || !item.options.every((option) => isSafeText(option, 500))))) {
      return false;
    }
    const event = eventById.get(item.subEventId);
    return event !== undefined
      && (EVENT_FIELDS[event.kind] as readonly string[]).includes(item.field);
  })) {
    errors.push(error(
      'clarifications',
      'invalid_clarifications',
      'Clarifications must target a known sub-event field.'
    ));
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: value as FarmActivityAssistantDraftV1 };
}

export function validateFarmActivityAssistantAction(
  value: unknown
): FarmActivityAssistantValidationResult<FarmActivityAssistantAction> {
  if (!isObject(value)
    || !isEnum(value.action, ['confirm', 'edit', 'cancel'] as const)
    || !isSafeId(value.draftId)
    || !Number.isSafeInteger(value.revision)
    || (value.revision as number) < 0) {
    return { ok: false, errors: [error('$', 'invalid_action', 'Action is invalid.')] };
  }

  let valid = false;
  switch (value.action) {
    case 'confirm':
      valid = hasExactKeys(value, ['action', 'draftId', 'revision']);
      break;
    case 'edit':
      valid = hasExactKeys(value, ['action', 'draftId', 'revision', 'subEvents'])
        && Array.isArray(value.subEvents)
        && value.subEvents.length > 0
        && value.subEvents.every(validSubEvent);
      break;
    case 'cancel':
      valid = hasExactKeys(value, ['action', 'draftId', 'revision'], ['reason'])
        && (value.reason === undefined || isSafeText(value.reason, 1_000));
      break;
  }
  return valid
    ? { ok: true, value: value as FarmActivityAssistantAction }
    : { ok: false, errors: [error('$', 'invalid_action', 'Action has invalid fields.')] };
}

function isField(value: unknown): value is FarmActivityAssistantField<unknown> {
  return isObject(value)
    && 'value' in value
    && 'confidence' in value
    && 'provenance' in value
    && 'sourceRefs' in value;
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function mergeSubEvent(
  current: FarmActivityAssistantSubEvent,
  incoming: FarmActivityAssistantSubEvent
): FarmActivityAssistantSubEvent {
  if (current.kind !== incoming.kind) {
    throw new Error(`Sub-event ${current.id} changed kind from ${current.kind} to ${incoming.kind}.`);
  }
  const merged: Record<string, unknown> = {
    ...current,
    ...incoming,
    sourceRefs: [...new Set([...current.sourceRefs, ...incoming.sourceRefs])],
  };
  for (const field of EVENT_FIELDS[current.kind]) {
    const previous = current[field as keyof typeof current];
    const next = incoming[field as keyof typeof incoming];
    if (isField(previous) && isField(next) && previous.value !== null && next.value === null) {
      merged[field] = previous;
    }
  }
  return merged as FarmActivityAssistantSubEvent;
}

/**
 * Merges incremental extraction without losing independent, already-clear
 * sub-events. Unresolved incoming fields cannot erase resolved field values.
 */
export function mergeFarmActivityAssistantDrafts(
  current: FarmActivityAssistantDraftV1,
  incoming: FarmActivityAssistantDraftV1
): FarmActivityAssistantDraftV1 {
  if (current.draftId !== incoming.draftId) throw new Error('Cannot merge different draft ids.');
  if (current.contractVersion !== incoming.contractVersion) {
    throw new Error('Cannot merge different contract versions.');
  }

  const incomingById = new Map(incoming.subEvents.map((item) => [item.id, item]));
  const mergedExisting = current.subEvents.map((item) => {
    const next = incomingById.get(item.id);
    return next ? mergeSubEvent(item, next) : item;
  });
  const currentIds = new Set(current.subEvents.map((item) => item.id));
  const appended = incoming.subEvents.filter((item) => !currentIds.has(item.id));

  return {
    ...incoming,
    revision: Math.max(current.revision, incoming.revision),
    source: {
      ...incoming.source,
      media: uniqueById([...current.source.media, ...incoming.source.media]),
      transcript: uniqueById([...current.source.transcript, ...incoming.source.transcript]),
    },
    subEvents: [...mergedExisting, ...appended].sort((a, b) => a.sequence - b.sequence),
    clarifications: uniqueById([...current.clarifications, ...incoming.clarifications]),
  };
}
