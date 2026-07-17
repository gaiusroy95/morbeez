import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
  validateFarmActivityAssistantDraft,
  type FarmActivityAssistantDraftV1,
  type FarmActivityAssistantField,
  type FarmActivityAssistantSubEvent,
} from '@morbeez/shared/farm-activity-assistant';
import {
  resolveDraftStatus,
  summarizeDraftFieldConfidence,
} from '../src/services/farm-activity/farm-activity-draft.service.js';
import {
  dedupeIndependentSubEvents,
  validateFarmActivityExtraction,
} from '../src/services/farm-activity/farm-activity-extraction.service.js';
import { detectFarmActivityLanguage } from '../src/services/farm-activity/farm-activity-language.service.js';

function field<T>(value: T, refs = ['msg-1']): FarmActivityAssistantField<T> {
  return {
    value,
    confidence: 'high',
    provenance: ['explicit_text'],
    sourceRefs: refs,
  };
}

function missing(detail: string, refs = ['msg-1']): FarmActivityAssistantField<never> {
  return {
    value: null,
    confidence: 'low',
    provenance: ['assistant_inference'],
    sourceRefs: refs,
    unresolved: { reason: 'missing', detail },
  };
}

function activity(partial?: Partial<FarmActivityAssistantSubEvent> & { id?: string }): FarmActivityAssistantSubEvent {
  return {
    id: partial?.id ?? 'event-1',
    kind: 'activity',
    sequence: 1,
    sourceRefs: ['msg-1'],
    occurredOn: field('2026-07-17'),
    activityType: field('spraying'),
    blockRef: missing('Plot not stated'),
    description: field('Sprayed crop'),
    quantity: missing('Dose not stated'),
    unit: missing('Unit not stated'),
    ...partial,
  } as FarmActivityAssistantSubEvent;
}

describe('farm activity language heuristic', () => {
  it('detects Malayalam script and marks English+Malayalam as code-mixed', () => {
    const result = detectFarmActivityLanguage('ഇന്ന് sprayed 2 litre', 'en');
    assert.equal(result.detectedLanguage, 'ml');
    assert.equal(result.codeMixed, true);
  });

  it('uses stored preference only as a hint when transcript has no signals', () => {
    const result = detectFarmActivityLanguage('???', 'ta');
    assert.equal(result.detectedLanguage, 'ta');
    assert.equal(result.codeMixed, false);
  });

  it('detects romanized Hindi terms without calling an external API', () => {
    const result = detectFarmActivityLanguage('aaj khet me mazdoor kiya', 'en');
    assert.equal(result.detectedLanguage, 'hi');
  });
});

describe('farm activity extraction validation', () => {
  it('rejects invented dose/cost without explicit provenance', () => {
    const result = validateFarmActivityExtraction({
      subEvents: [{
        id: 'event-1',
        kind: 'purchase',
        sequence: 1,
        sourceRefs: ['msg-1'],
        occurredOn: field('2026-07-17'),
        itemName: {
          value: 'Urea',
          confidence: 'medium',
          provenance: ['assistant_inference'],
          sourceRefs: ['msg-1'],
        },
        vendorName: missing('Vendor missing'),
        quantity: field(50),
        unit: field('kg'),
        unitPrice: missing('Price missing'),
        totalCost: field({ amount: 1200, currency: 'INR' }),
      }],
      clarifications: [],
    }, {
      sourceRefs: new Set(['msg-1']),
      blockRefs: new Set(['block-1']),
      clarificationAttempts: 0,
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors.join(' '), /itemName cannot be invented/);
  });

  it('allows only one clarification and enforces max two attempts', () => {
    const payload = {
      subEvents: [activity()],
      clarifications: [
        { id: 'c1', question: 'Which plot?', subEventId: 'event-1', field: 'blockRef', required: true },
        { id: 'c2', question: 'What dose?', subEventId: 'event-1', field: 'quantity', required: true },
      ],
    };
    const tooMany = validateFarmActivityExtraction(payload, {
      sourceRefs: new Set(['msg-1']),
      blockRefs: new Set(['north plot']),
      clarificationAttempts: 0,
    });
    assert.equal(tooMany.ok, false);

    const maxAttempts = validateFarmActivityExtraction({
      subEvents: [activity()],
      clarifications: [payload.clarifications[0]!],
    }, {
      sourceRefs: new Set(['msg-1']),
      blockRefs: new Set(['north plot']),
      clarificationAttempts: 2,
    });
    assert.equal(maxAttempts.ok, false);
    if (!maxAttempts.ok) assert.match(maxAttempts.errors.join(' '), /maximum clarification/);
  });

  it('keeps independent clear sub-events when deduping', () => {
    const spray = activity({ id: 'spray', activityType: field('spraying') });
    const labour: FarmActivityAssistantSubEvent = {
      id: 'labour',
      kind: 'labour',
      sequence: 2,
      sourceRefs: ['msg-1'],
      occurredOn: field('2026-07-17'),
      workType: field('weeding'),
      workerCount: field(3),
      durationHours: field(4),
      rate: missing('Rate missing'),
      totalCost: missing('Cost missing'),
    };
    const duplicateSpray = activity({ id: 'spray-dup', activityType: field('spraying') });
    const merged = dedupeIndependentSubEvents([spray, labour, duplicateSpray]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.kind, 'activity');
    assert.equal(merged[1]?.kind, 'labour');
  });
});

describe('farm activity draft persistence helpers', () => {
  it('summarizes field-level confidence and unresolved provenance', () => {
    const draft: FarmActivityAssistantDraftV1 = {
      contractVersion: FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
      draftId: 'draft-1',
      revision: 1,
      source: {
        messageId: 'msg-1',
        channel: 'whatsapp',
        language: { code: 'ml', detected: true, confidence: 'high' },
        media: [],
        transcript: [{ id: 't1', text: 'ഇന്ന് sprayed' }],
      },
      subEvents: [activity()],
      clarifications: [{
        id: 'c1',
        question: 'Which plot should I record?',
        subEventId: 'event-1',
        field: 'blockRef',
        required: true,
      }],
    };

    assert.equal(validateFarmActivityAssistantDraft(draft).ok, true);
    assert.equal(resolveDraftStatus(draft), 'clarifying');
    const summary = summarizeDraftFieldConfidence(draft);
    assert.equal(summary.fieldConfidence['event-1.activityType']?.confidence, 'high');
    assert.ok(summary.unresolvedFields.some((item) =>
      typeof item === 'object'
      && item
      && (item as { field?: string }).field === 'quantity'));
  });
});
