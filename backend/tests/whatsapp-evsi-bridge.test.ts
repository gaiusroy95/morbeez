import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maiosEvsiWhatsappBridgeService } from '../src/services/maios-reasoning/maios-evsi-whatsapp-bridge.service.js';
import type { MaiosReasoningSnapshot } from '../src/domain/maios-reasoning/types.js';

function baseSnapshot(overrides: Partial<MaiosReasoningSnapshot> = {}): MaiosReasoningSnapshot {
  return {
    pipelineVersion: '17.0',
    knowledgeVersion: '1.0',
    evidence: [],
    prior: [],
    posterior: [],
    decision: {
      action: 'CONTINUE',
      topLabel: 'Pyricularia leaf blast',
      topConfidence: 0.62,
      threshold: 0.85,
      evidenceCount: 2,
      reviewRequired: true,
      reason: 'Continue',
    },
    explanation: {
      diagnosis: 'Pyricularia leaf blast',
      confidence: 0.62,
      supporting: [],
      rejected: [],
      missing: [],
    },
    nextEvidence: {
      kind: 'question',
      id: 'black_dots_in_lesion',
      label: 'Are black dots visible inside the lesions?',
      expectedInformationGain: 14.2,
    },
    management: null,
    safety: null,
    finalReport: null,
    shadowMode: true,
    ...overrides,
  };
}

describe('MAIOS EVSI WhatsApp bridge', () => {
  it('builds yes_no follow-up from reasoning nextEvidence', () => {
    const q = maiosEvsiWhatsappBridgeService.buildFollowUpFromReasoning({
      reasoning: baseSnapshot(),
      priorAnswers: {},
      questionsAsked: 0,
      maxQuestions: 3,
    });
    assert.ok(q);
    assert.equal(q!.id, 'black_dots_in_lesion');
    assert.equal(q!.kind, 'yes_no');
    assert.match(q!.text, /black dots/i);
  });

  it('skips already-answered EVSI question ids', () => {
    const q = maiosEvsiWhatsappBridgeService.buildFollowUpFromReasoning({
      reasoning: baseSnapshot(),
      priorAnswers: { black_dots_in_lesion: 'yes' },
      questionsAsked: 1,
      maxQuestions: 3,
    });
    assert.equal(q, null);
  });

  it('builds photo_slot follow-up when EVSI ranks missing photo', () => {
    const q = maiosEvsiWhatsappBridgeService.buildFollowUpFromReasoning({
      reasoning: baseSnapshot({
        nextEvidence: {
          kind: 'photo_slot',
          id: 'leaf_closeup',
          label: 'Capture photo: leaf closeup',
          expectedInformationGain: 9.5,
        },
      }),
      priorAnswers: {},
      questionsAsked: 0,
      maxQuestions: 3,
    });
    assert.ok(q);
    assert.equal(q!.kind, 'photo');
    assert.equal(q!.id, 'photo:leaf_closeup');
  });
});
