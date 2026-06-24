import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEvidenceDeltas,
  buildHypothesisDistribution,
  distributionThresholdReached,
} from '../src/domain/visit-ai/confidence-distribution.js';

describe('confidence distribution', () => {
  it('normalizes hypotheses to sum to 100 with unknown bucket', () => {
    const dist = buildHypothesisDistribution([
      { label: 'Root Stress', confidence: 0.68 },
      { label: 'Zn Deficiency', confidence: 0.18 },
      { label: 'Thrips', confidence: 0.08 },
    ]);
    const sum = dist.hypotheses.reduce((a, h) => a + h.weight, 0) + dist.unknownWeight;
    assert.equal(sum, 100);
    assert.ok(dist.unknownWeight >= 2);
    assert.equal(dist.hypotheses[0]?.label, 'Root Stress');
  });

  it('detects threshold reached at 85%', () => {
    const dist = buildHypothesisDistribution([{ label: 'Root Stress', weight: 88 }]);
    assert.equal(distributionThresholdReached(dist), true);
  });

  it('applies evidence deltas and renormalizes', () => {
    const base = buildHypothesisDistribution([
      { label: 'Root Stress', weight: 68 },
      { label: 'Zn Deficiency', weight: 18 },
      { label: 'Thrips', weight: 8 },
    ]);
    const next = applyEvidenceDeltas(base, [
      { label: 'Root Stress', delta: 8 },
      { label: 'Zn Deficiency', delta: -2 },
      { label: 'Unknown', delta: -3 },
    ]);
    const sum = next.hypotheses.reduce((a, h) => a + h.weight, 0) + next.unknownWeight;
    assert.equal(sum, 100);
    assert.ok(next.topConfidence >= base.topConfidence);
  });
});
