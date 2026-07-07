import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maiosEvsiVisitBridgeService } from '../src/services/maios-reasoning/maios-evsi-visit-bridge.service.js';
import type { MaiosReasoningSnapshot } from '../src/domain/maios-reasoning/types.js';
import { maiosEvidenceRepositoryService } from '../src/services/maios-reasoning/evidence-repository.service.js';
import { GINGER_PACK } from '../src/domain/crop-pack/packs/ginger.pack.js';

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

describe('MAIOS EVSI visit bridge', () => {
  it('prepends EVSI question before LLM drafts', () => {
    const merged = maiosEvsiVisitBridgeService.prependEvsiDrafts(
      [{ questionText: 'When did you last irrigate?', answerType: 'yes_no_unknown' }],
      baseSnapshot()
    );
    assert.equal(merged[0]?.questionText, 'Are black dots visible inside the lesions?');
    assert.equal(merged[0]?.evsiQuestionId, 'black_dots_in_lesion');
    assert.equal(merged.length, 2);
  });

  it('skips EVSI injection when diagnosis is LOCK', () => {
    const merged = maiosEvsiVisitBridgeService.prependEvsiDrafts(
      [{ questionText: 'When did you last irrigate?', answerType: 'yes_no_unknown' }],
      baseSnapshot({
        decision: {
          action: 'LOCK',
          topLabel: 'Pyricularia leaf blast',
          topConfidence: 0.91,
          threshold: 0.85,
          evidenceCount: 5,
          reviewRequired: false,
          reason: 'Locked',
        },
      })
    );
    assert.equal(merged.length, 1);
    assert.match(merged[0]!.questionText, /irrigate/);
  });

  it('maps EVSI answer by questionId into evidence repository', () => {
    const evidence = maiosEvidenceRepositoryService.merge({
      contextItems: [],
      photos: [],
      pack: GINGER_PACK,
      cropType: 'ginger',
      farmerAnswers: [
        {
          questionId: 'black_dots_in_lesion',
          questionText: 'Are black dots visible inside the lesions?',
          answer: 'yes',
        },
      ],
    });
    assert.ok(evidence.some((e) => e.key === 'farmer:black_dots_yes'));
  });
});
