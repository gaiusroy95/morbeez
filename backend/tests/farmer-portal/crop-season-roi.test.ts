import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function netProfit(income: number, expense: number): number {
  return income - expense;
}

function roiPercent(profit: number, investment: number): number {
  return investment > 0 ? Math.round((profit / investment) * 100) : 0;
}

describe('crop season ROI math', () => {
  it('computes net profit as income minus expenses', () => {
    assert.equal(netProfit(245000, 84500), 160500);
  });

  it('computes ROI percent', () => {
    assert.equal(roiPercent(160500, 84500), 190);
  });

  it('handles zero investment', () => {
    assert.equal(roiPercent(1000, 0), 0);
  });

  it('computes harvest income from yield and price', () => {
    const total = Math.round(1200 * 45.5 * 100) / 100;
    assert.equal(total, 54600);
  });
});
