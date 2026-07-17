import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExpertCaseKey,
  normalizeIssueFingerprint,
  priorityTierFromPriority,
  queueWeightForPriority,
  slaMinutesForPriority,
} from '../src/domain/expert-case/types.js';

describe('Expert Copilot domain policy', () => {
  it('normalizes equivalent issue labels to the same dedupe fingerprint', () => {
    assert.equal(
      normalizeIssueFingerprint('  Yellow-leaf!!   SPOTS '),
      normalizeIssueFingerprint('yellow leaf spots')
    );
    assert.equal(normalizeIssueFingerprint('---'), 'unknown');
    assert.equal(normalizeIssueFingerprint('x'.repeat(100)).length, 80);
  });

  it('builds stable case keys and separates later generations', () => {
    const base = {
      farmerId: 'farmer-1',
      blockId: null,
      fingerprint: 'yellow leaf',
    };

    assert.equal(buildExpertCaseKey(base), 'ec:farmer-1:noblock:yellow leaf');
    assert.equal(buildExpertCaseKey({ ...base, generation: 1 }), buildExpertCaseKey(base));
    assert.equal(
      buildExpertCaseKey({ ...base, blockId: 'block-2', generation: 2 }),
      'ec:farmer-1:block-2:yellow leaf:g2'
    );
  });

  it('maps priority to tier, SLA, and queue weight', () => {
    assert.deepEqual(
      ['urgent', 'high', 'normal', 'low'].map((priority) => ({
        priority,
        tier: priorityTierFromPriority(priority),
        sla: slaMinutesForPriority(priority),
        weight: queueWeightForPriority(priority),
      })),
      [
        { priority: 'urgent', tier: 'emergency', sla: 30, weight: 2 },
        { priority: 'high', tier: 'sla_risk', sla: 120, weight: 1.5 },
        { priority: 'normal', tier: 'standard', sla: 240, weight: 1 },
        { priority: 'low', tier: 'standard', sla: 480, weight: 0.5 },
      ]
    );
  });
});
