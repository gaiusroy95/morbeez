import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function weeklyTrendPct(current: number, previous: number | null): number | null {
  if (previous == null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function opportunitySignal(yoyPct: number | null, weeklyPct: number | null): 'strong' | 'weak' | 'neutral' {
  const score = (yoyPct ?? 0) + (weeklyPct ?? 0) * 0.5;
  if (score >= 5) return 'strong';
  if (score <= -5) return 'weak';
  return 'neutral';
}

describe('market insight helpers', () => {
  it('computes weekly trend percent', () => {
    assert.equal(weeklyTrendPct(108, 100), 8);
    assert.equal(weeklyTrendPct(92, 100), -8);
    assert.equal(weeklyTrendPct(100, 0), null);
  });

  it('classifies crop opportunity signal', () => {
    assert.equal(opportunitySignal(8, 4), 'strong');
    assert.equal(opportunitySignal(-8, -4), 'weak');
    assert.equal(opportunitySignal(2, 1), 'neutral');
  });
});
