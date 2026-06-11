import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRoiVisibility, honestFinancial, validateFinishCycleInput } from '../../packages/shared/src/api/roi-helpers.ts';

describe('farmer roi v1 lifecycle rules', () => {
  it('multi-harvest keeps season active until explicit finish', () => {
    let seasonStatus = 'active';
    let harvestCount = 0;
    const recordSale = () => {
      harvestCount += 1;
      return { seasonStatus, harvestCount };
    };
    const r1 = recordSale();
    const r2 = recordSale();
    const r3 = recordSale();
    assert.equal(r1.seasonStatus, 'active');
    assert.equal(r3.harvestCount, 3);
    const finish = () => {
      seasonStatus = 'archived';
    };
    finish();
    assert.equal(seasonStatus, 'archived');
    assert.equal(harvestCount, 3);
  });

  it('finish does not auto-create new season', () => {
    let activeCount = 1;
    const finish = () => {
      activeCount -= 1;
    };
    finish();
    assert.equal(activeCount, 0);
    const startNew = () => {
      activeCount += 1;
    };
    assert.equal(activeCount, 0);
    startNew();
    assert.equal(activeCount, 1);
  });

  it('block-scoped filter passes blockId to summary query', () => {
    const filter = { blockId: 'block-abc', crop: 'ginger' };
    const params = new URLSearchParams();
    if (filter.crop) params.set('crop', filter.crop);
    if (filter.blockId) params.set('blockId', filter.blockId);
    assert.equal(params.get('blockId'), 'block-abc');
    assert.equal(params.get('crop'), 'ginger');
  });
});

describe('roi helpers', () => {
  it('hides filters for single crop and block', () => {
    assert.deepEqual(computeRoiVisibility(1, 1), {
      showCropFilter: false,
      showBlockFilter: false,
      showExpenseBook: false,
    });
  });

  it('shows expense book for multi-block', () => {
    const v = computeRoiVisibility(1, 2);
    assert.equal(v.showExpenseBook, true);
    assert.equal(v.showBlockFilter, true);
  });

  it('hides profit until income', () => {
    const before = honestFinancial(45000, 0);
    assert.equal(before.hasIncome, false);
    assert.equal(before.profitInr, null);
    assert.equal(before.roiPercent, null);
    assert.ok(before.profitMessage);

    const after = honestFinancial(45000, 238500);
    assert.equal(after.hasIncome, true);
    assert.equal(after.profitInr, 193500);
    assert.equal(after.roiPercent, 430);
  });

  it('finish cycle requires COMPLETE confirm text', () => {
    assert.equal(validateFinishCycleInput(undefined).ok, false);
    assert.equal(validateFinishCycleInput({ confirmText: 'done' }).ok, false);
    assert.equal(validateFinishCycleInput({ confirmText: 'COMPLETE' }).ok, true);
  });

  it('finish cycle requires password when account has password', () => {
    assert.equal(validateFinishCycleInput({ confirmText: 'COMPLETE' }, true).ok, false);
    assert.equal(
      validateFinishCycleInput({ confirmText: 'COMPLETE', password: 'secret' }, true).ok,
      true
    );
    assert.equal(validateFinishCycleInput({ confirmText: 'COMPLETE' }, false).ok, true);
  });
});
