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
      topLabel: 'Hypothesis A',
      topConfidence: 0.62,
      threshold: 0.85,
      evidenceCount: 2,
      reviewRequired: true,
      reason: 'Continue',
    },
    explanation: {
      diagnosis: 'Hypothesis A',
      confidence: 0.62,
      supporting: [],
      rejected: [],
      missing: [],
    },
    nextEvidence: {
      kind: 'question',
      id: 'lesion_detail_check',
      label: 'Pack template text — must not be sent to farmers',
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
  it('exposes planner hint metadata without pack question text', () => {
    const hint = maiosEvsiWhatsappBridgeService.plannerHintFromReasoning(baseSnapshot(), {});
    assert.ok(hint);
    assert.equal(hint!.questionId, 'lesion_detail_check');
    assert.equal(hint!.kind, 'yes_no');
    assert.equal(hint!.evidenceSlot, 'lesion_detail_check');
  });

  it('does not build verbatim farmer questions from reasoning', () => {
    const q = maiosEvsiWhatsappBridgeService.buildFollowUpFromReasoning({
      reasoning: baseSnapshot(),
      priorAnswers: {},
      questionsAsked: 0,
      maxQuestions: 3,
    });
    assert.equal(q, null);
  });

  it('skips already-answered EVSI question ids in planner hint', () => {
    const hint = maiosEvsiWhatsappBridgeService.plannerHintFromReasoning(baseSnapshot(), {
      lesion_detail_check: 'yes',
    });
    assert.equal(hint, null);
  });

  it('builds photo slot planner hint when EVSI ranks missing photo', () => {
    const hint = maiosEvsiWhatsappBridgeService.plannerHintFromReasoning(
      baseSnapshot({
        nextEvidence: {
          kind: 'photo_slot',
          id: 'leaf_closeup',
          label: 'Capture photo: leaf closeup',
          expectedInformationGain: 9.5,
        },
      }),
      {}
    );
    assert.ok(hint);
    assert.equal(hint!.kind, 'photo');
    assert.equal(hint!.questionId, 'photo:leaf_closeup');
  });
});
