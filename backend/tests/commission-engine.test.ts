import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function reliabilityHoldPct(score: number): number {
  if (score >= 85) return 0;
  if (score >= 70) return 0;
  if (score >= 50) return 20;
  return 100;
}

describe('commission reliability holds', () => {
  it('holds 100% below score 50', () => {
    assert.equal(reliabilityHoldPct(45), 100);
  });

  it('holds 20% for scores 50–69', () => {
    assert.equal(reliabilityHoldPct(65), 20);
  });

  it('no hold at 85+', () => {
    assert.equal(reliabilityHoldPct(90), 0);
  });
});

describe('commission rule types', () => {
  it('fixed_pct computes from gross', () => {
    const gross = 10000;
    const rate = 8;
    const commission = (gross * rate) / 100;
    assert.equal(commission, 800);
  });
});
