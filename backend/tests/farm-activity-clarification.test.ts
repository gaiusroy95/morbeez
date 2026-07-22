import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
  type FarmActivityAssistantDraftV1,
  type FarmActivityAssistantField,
} from '@morbeez/shared/farm-activity-assistant';
import {
  applyClarificationAnswer,
  resolveBlockRefFromBlocks,
} from '../src/services/farm-activity/farm-activity-clarification.service.js';
import type { BlockWithDap } from '../src/services/core/block.service.js';

function field<T>(value: T): FarmActivityAssistantField<T> {
  return {
    value,
    confidence: 'high',
    provenance: ['explicit_text'],
    sourceRefs: ['msg-1'],
  };
}

function missing(): FarmActivityAssistantField<never> {
  return {
    value: null,
    confidence: 'low',
    provenance: ['assistant_inference'],
    sourceRefs: ['msg-1'],
    unresolved: { reason: 'missing', detail: 'Plot/block was not stated.' },
  };
}

const blocks: BlockWithDap[] = [
  {
    id: 'block-ginger-1',
    farmer_id: 'farmer-1',
    name: 'Ginger Plot',
    crop_type: 'ginger',
    crop_name: 'Ginger',
    crop_category: null,
    crop_subtype: null,
    plot_label: 'Ginger Plot',
    variety_name: null,
    planting_date: '2026-01-01',
    stage: null,
    acreage_decimal: 3.5,
    is_primary: true,
    pincode_id: null,
    irrigation_type: null,
    latitude: null,
    longitude: null,
    location_captured_at: null,
    location_source: null,
    created_at: '2026-01-01T00:00:00.000Z',
    dap: 100,
  },
];

describe('resolveBlockRefFromBlocks', () => {
  it('matches crop name ginger', () => {
    assert.equal(resolveBlockRefFromBlocks(blocks, 'ginger'), 'block-ginger-1');
  });

  it('matches plot label Ginger Plot', () => {
    assert.equal(resolveBlockRefFromBlocks(blocks, 'Ginger Plot'), 'block-ginger-1');
  });

  it('matches crop.* button id', () => {
    assert.equal(resolveBlockRefFromBlocks(blocks, 'crop.ginger'), 'block-ginger-1');
  });
});

describe('applyClarificationAnswer', () => {
  it('fills blockRef and clears pending clarification', () => {
    const draft: FarmActivityAssistantDraftV1 = {
      contractVersion: FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
      draftId: 'draft-1',
      revision: 1,
      source: {
        messageId: 'msg-1',
        channel: 'whatsapp',
        language: { code: 'en', detected: true, confidence: 'high' },
        media: [],
        transcript: [],
      },
      subEvents: [{
        id: 'event-1',
        kind: 'activity',
        sequence: 1,
        sourceRefs: ['msg-1'],
        occurredOn: field('2026-07-22'),
        activityType: field('fertilizer application'),
        blockRef: missing(),
        description: field('19:19:19 fertilizer'),
        quantity: field(70),
        unit: field('kg'),
      }],
      clarifications: [{
        id: 'clarify-1',
        question: 'Which plot / block is this for?',
        subEventId: 'event-1',
        field: 'blockRef',
        required: true,
      }],
    };

    const updated = applyClarificationAnswer({
      draft,
      clarification: draft.clarifications[0]!,
      answerText: 'ginger',
      messageId: 'msg-2',
      blockRef: 'block-ginger-1',
    });

    assert.ok(updated);
    assert.equal(updated!.clarifications.length, 0);
    assert.equal(updated!.subEvents[0]?.kind === 'activity' && updated!.subEvents[0].blockRef.value, 'block-ginger-1');
  });
});
