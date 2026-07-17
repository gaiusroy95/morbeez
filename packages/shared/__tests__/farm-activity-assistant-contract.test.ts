import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
  mergeFarmActivityAssistantDrafts,
  validateFarmActivityAssistantAction,
  validateFarmActivityAssistantDraft,
  type FarmActivityAssistantDraftV1,
  type FarmActivityAssistantField,
} from '../src/farm-activity-assistant/index.js';

function field<T>(value: T): FarmActivityAssistantField<T> {
  return {
    value,
    confidence: 'high',
    provenance: ['explicit_text'],
    sourceRefs: ['message-1'],
  };
}

function unresolved<T>(detail: string): FarmActivityAssistantField<T> {
  return {
    value: null,
    confidence: 'low',
    provenance: ['assistant_inference'],
    sourceRefs: ['message-1'],
    unresolved: { reason: 'ambiguous', detail },
  };
}

function draft(): FarmActivityAssistantDraftV1 {
  return {
    contractVersion: FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
    draftId: 'draft-1',
    revision: 1,
    source: {
      messageId: 'message-1',
      channel: 'whatsapp',
      text: 'Sprayed neem yesterday and paid two workers.',
      language: { code: 'en-IN', detected: true, confidence: 'high' },
      media: [{
        id: 'audio-1',
        kind: 'audio',
        mimeType: 'audio/ogg',
        uri: 'storage://audio-1',
      }],
      transcript: [{
        id: 'segment-1',
        text: 'Sprayed neem yesterday and paid two workers.',
        mediaRef: 'audio-1',
        languageCode: 'en-IN',
      }],
    },
    subEvents: [{
      id: 'event-activity-1',
      kind: 'activity',
      sequence: 0,
      sourceRefs: ['segment-1'],
      occurredOn: field('2026-07-16'),
      activityType: field('spray'),
      blockRef: unresolved('The block was not stated.'),
      description: field('Applied neem spray.'),
      quantity: unresolved('The quantity was not stated.'),
      unit: unresolved('The unit was not stated.'),
    }, {
      id: 'event-labour-1',
      kind: 'labour',
      sequence: 1,
      sourceRefs: ['segment-1'],
      occurredOn: field('2026-07-16'),
      workType: field('spraying'),
      workerCount: field(2),
      durationHours: unresolved('Duration was not stated.'),
      rate: unresolved('Rate was not stated.'),
      totalCost: unresolved('Total labour cost was not stated.'),
    }],
    clarifications: [{
      id: 'clarification-1',
      question: 'How much neem spray was used?',
      subEventId: 'event-activity-1',
      field: 'quantity',
      required: true,
    }],
  };
}

describe('farm activity assistant v1 validation', () => {
  it('accepts independent typed sub-events and source context', () => {
    const result = validateFarmActivityAssistantDraft(draft());
    assert.equal(result.ok, true);
  });

  it('requires field-level metadata and valid clarification targets', () => {
    const missingMetadata = draft() as unknown as Record<string, unknown>;
    const events = missingMetadata.subEvents as Array<Record<string, unknown>>;
    events[0]!.description = { value: 'Applied neem spray.' };
    assert.equal(validateFarmActivityAssistantDraft(missingMetadata).ok, false);

    const badTarget = draft();
    badTarget.clarifications[0]!.field = 'approval';
    assert.equal(validateFarmActivityAssistantDraft(badTarget).ok, false);
  });

  it('allowlists Confirm, Edit, and Cancel action shapes', () => {
    assert.equal(validateFarmActivityAssistantAction({
      action: 'confirm',
      draftId: 'draft-1',
      revision: 1,
    }).ok, true);
    assert.equal(validateFarmActivityAssistantAction({
      action: 'cancel',
      draftId: 'draft-1',
      revision: 1,
      reason: 'Sent by mistake',
    }).ok, true);
    assert.equal(validateFarmActivityAssistantAction({
      action: 'submit',
      draftId: 'draft-1',
      revision: 1,
    }).ok, false);
  });
});

describe('farm activity assistant draft merge', () => {
  it('preserves clear fields and independent sub-events', () => {
    const current = draft();
    const incoming = draft();
    incoming.revision = 2;
    const activity = incoming.subEvents[0];
    assert.equal(activity?.kind, 'activity');
    if (!activity || activity.kind !== 'activity') return;
    activity.description = unresolved('A later transcript was unclear.');
    incoming.subEvents = [activity, {
      id: 'event-expense-1',
      kind: 'expense',
      sequence: 2,
      sourceRefs: ['segment-1'],
      occurredOn: field('2026-07-16'),
      category: field('labour'),
      description: field('Paid spraying workers.'),
      amount: field({ amount: 1_200, currency: 'INR' }),
      paidTo: unresolved('Worker names were not stated.'),
    }];

    const merged = mergeFarmActivityAssistantDrafts(current, incoming);

    assert.equal(merged.subEvents.length, 3);
    const mergedActivity = merged.subEvents.find((event) => event.id === 'event-activity-1');
    assert.equal(mergedActivity?.kind, 'activity');
    if (mergedActivity?.kind === 'activity') {
      assert.equal(mergedActivity.description.value, 'Applied neem spray.');
    }
    assert.equal(merged.subEvents.some((event) => event.id === 'event-labour-1'), true);
    assert.equal(merged.subEvents.some((event) => event.id === 'event-expense-1'), true);
  });
});
