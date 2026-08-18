import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blocksPayout, payoutHoldFromFlags } from '../src/domain/remuneration/fraud-hold.js';
import { adjustmentRow, disputeAdjustmentInr } from '../src/domain/remuneration/dispute-adjustment.js';
import { eligibleRoi, marketingCac } from '../src/domain/remuneration/marketing-cac.js';
import { addToBucket, emptyBuckets, lastNMonths } from '../src/domain/remuneration/earning-drilldown.js';

describe('fraud hold', () => {
  it('blocks payout while a flag is open or confirmed', () => {
    assert.equal(blocksPayout('open'), true);
    assert.equal(blocksPayout('confirmed'), true);
    assert.equal(blocksPayout('cleared'), false);
    const hold = payoutHoldFromFlags([{ status: 'open' }, { status: 'cleared' }]);
    assert.equal(hold.hold, true);
    assert.equal(payoutHoldFromFlags([{ status: 'cleared' }]).hold, false);
  });
});

describe('dispute adjustment', () => {
  it('writes a negative row and never exceeds the original', () => {
    assert.equal(disputeAdjustmentInr(1000, 400), 400);
    assert.equal(disputeAdjustmentInr(1000, 1500), 1000);
    const row = adjustmentRow({ originalId: 'abc', originalInr: 900, disputedInr: 300, reason: 'return' });
    assert.equal(row.parentEarningId, 'abc');
    assert.equal(row.amountInr, -300);
  });
});

describe('marketing CAC from eligible sales', () => {
  it('is spend divided by eligible order count, not checkout paid', () => {
    assert.equal(marketingCac(10_000, 4), 2500);
    assert.equal(marketingCac(10_000, 0), null);
    assert.equal(eligibleRoi(25_000, 10_000), 2.5);
  });
});

describe('three-month drill-down', () => {
  it('buckets earned / held / due / paid without rewriting history', () => {
    const months = lastNMonths(3, new Date('2026-08-18T00:00:00Z'));
    assert.deepEqual(months, ['2026-08', '2026-07', '2026-06']);
    const buckets = emptyBuckets(months);
    addToBucket(buckets, '2026-08', 'earned', 800);
    addToBucket(buckets, '2026-08', 'held', 200);
    addToBucket(buckets, '2026-07', 'paid', 500);
    assert.equal(buckets[0].earned, 800);
    assert.equal(buckets[0].held, 200);
    assert.equal(buckets[1].paid, 500);
    assert.equal(buckets[2].earned, 0);
  });
});
