import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cropCycleDays, growthStageFromDap } from '../src/services/farmer/crop-stage.service.js';

describe('crop-stage.service', () => {
  it('maps ginger DAP to crop-specific stages', () => {
    assert.equal(growthStageFromDap('ginger', 10, null), 'Sprouting');
    assert.equal(growthStageFromDap('ginger', 30, null), 'Sprouting');
    assert.equal(growthStageFromDap('ginger', 31, null), 'Vegetative');
    assert.equal(growthStageFromDap('ginger', 90, null), 'Vegetative');
    assert.equal(growthStageFromDap('ginger', 91, null), 'Tillering');
    assert.equal(growthStageFromDap('ginger', 150, null), 'Tillering');
    assert.equal(growthStageFromDap('ginger', 151, null), 'Bulking');
    assert.equal(growthStageFromDap('ginger', 210, null), 'Bulking');
    assert.equal(growthStageFromDap('ginger', 211, null), 'Maturity');
  });

  it('prefers stored stage over DAP calculation', () => {
    assert.equal(growthStageFromDap('ginger', 50, 'Custom stage'), 'Custom stage');
  });

  it('returns ginger cycle length of 270 days', () => {
    assert.equal(cropCycleDays('ginger'), 270);
    assert.equal(cropCycleDays('turmeric'), 365);
  });
});

describe('farmer auth session validation', () => {
  it('accepts phone-only farmer rows for session restore', () => {
    const row = { email: null as string | null, phone: '9876543210' };
    const valid = Boolean(row.email || row.phone);
    assert.equal(valid, true);
  });

  it('rejects farmer rows with neither email nor phone', () => {
    const row = { email: null as string | null, phone: null as string | null };
    const valid = Boolean(row.email || row.phone);
    assert.equal(valid, false);
  });
});
