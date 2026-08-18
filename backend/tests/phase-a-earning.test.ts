import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  agronomistPoolInr,
  agronomistSalesIncentiveInr,
  agronomistUnlockPct,
  partnerIncentiveInr,
  partnerKpiFactor,
} from '../src/domain/remuneration/kpi-factor.js';
import { evaluateEligibleSale } from '../src/domain/remuneration/eligible-sale.js';
import { splitSettlement } from '../src/domain/remuneration/settlement-split.js';
import { resolvePoolSplit, validatePoolSplit } from '../src/domain/remuneration/pool-split.js';

describe('partner KPI factor bands', () => {
  it('maps score bands to 70/80/90/95/100%', () => {
    assert.equal(partnerKpiFactor(59), 0.7);
    assert.equal(partnerKpiFactor(60), 0.8);
    assert.equal(partnerKpiFactor(69), 0.8);
    assert.equal(partnerKpiFactor(70), 0.9);
    assert.equal(partnerKpiFactor(80), 0.95);
    assert.equal(partnerKpiFactor(90), 1);
    assert.equal(partnerKpiFactor(100), 1);
  });
});

describe('agronomist sales slabs', () => {
  it('unlocks 0 / 50 / 75 / 100 of the agronomist pool', () => {
    assert.equal(agronomistUnlockPct(299_999), 0);
    assert.equal(agronomistUnlockPct(300_000), 50);
    assert.equal(agronomistUnlockPct(499_999), 50);
    assert.equal(agronomistUnlockPct(500_000), 75);
    assert.equal(agronomistUnlockPct(800_000), 100);
  });

  it('pays pool × unlock %', () => {
    assert.equal(agronomistPoolInr({ eligibleItemInr: 10000, agronomistPoolPct: 6 }), 600);
    assert.equal(agronomistSalesIncentiveInr(600, 50), 300);
    assert.equal(agronomistSalesIncentiveInr(600, 0), 0);
  });
});

describe('partner incentive formula', () => {
  it('is eligible item × partner % × KPI factor', () => {
    assert.equal(
      partnerIncentiveInr({ eligibleItemInr: 10_000, partnerPoolPct: 10, kpiFactor: 0.9 }),
      900
    );
  });
});

describe('Channel Pool split', () => {
  it('gives partner the full pool when partner max is omitted', () => {
    const split = resolvePoolSplit({ poolPct: 16, agronomistMaxPct: null, partnerMaxPct: null });
    assert.equal(split.poolPct, 16);
    assert.equal(split.agronomistMaxPct, 0);
    assert.equal(split.partnerMaxPct, 16);
  });

  it('rejects agro + partner above the pool', () => {
    assert.throws(() =>
      validatePoolSplit({ poolPct: 16, agronomistMaxPct: 10, partnerMaxPct: 10 })
    );
    validatePoolSplit({ poolPct: 16, agronomistMaxPct: 6, partnerMaxPct: 10 });
  });
});

describe('eligible net delivered sale', () => {
  it('stays pending payment until paid', () => {
    const r = evaluateEligibleSale({
      paid: false,
      omsStatus: 'confirmed',
      deliveredAt: null,
      cancelled: false,
      returned: false,
      refunded: false,
      fraud: false,
      excluded: false,
      returnWindowDays: 7,
    });
    assert.equal(r.status, 'pending_payment');
  });

  it('waits for delivery after payment', () => {
    const r = evaluateEligibleSale({
      paid: true,
      omsStatus: 'shipped',
      deliveredAt: null,
      cancelled: false,
      returned: false,
      refunded: false,
      fraud: false,
      excluded: false,
      returnWindowDays: 7,
    });
    assert.equal(r.status, 'pending_delivery');
  });

  it('holds through the return window then becomes eligible', () => {
    const deliveredAt = '2026-08-01T00:00:00.000Z';
    const waiting = evaluateEligibleSale({
      paid: true,
      omsStatus: 'delivered',
      deliveredAt,
      cancelled: false,
      returned: false,
      refunded: false,
      fraud: false,
      excluded: false,
      returnWindowDays: 7,
      now: new Date('2026-08-05T00:00:00.000Z'),
    });
    assert.equal(waiting.status, 'pending_return_window');
    const ready = evaluateEligibleSale({
      paid: true,
      omsStatus: 'delivered',
      deliveredAt,
      cancelled: false,
      returned: false,
      refunded: false,
      fraud: false,
      excluded: false,
      returnWindowDays: 7,
      now: new Date('2026-08-08T00:00:00.000Z'),
    });
    assert.equal(ready.status, 'eligible');
  });

  it('excludes refunds and fraud', () => {
    assert.equal(
      evaluateEligibleSale({
        paid: true,
        omsStatus: 'delivered',
        deliveredAt: '2026-08-01T00:00:00.000Z',
        cancelled: false,
        returned: false,
        refunded: true,
        fraud: false,
        excluded: false,
        returnWindowDays: 7,
        now: new Date('2026-08-20T00:00:00.000Z'),
      }).status,
      'excluded'
    );
  });
});

describe('80/20 settlement', () => {
  it('pays 80% after +2 months and 20% after +3', () => {
    const parts = splitSettlement(1000, '2026-08');
    assert.equal(parts[0]?.tranche, 'eighty');
    assert.equal(parts[0]?.amountInr, 800);
    assert.equal(parts[0]?.payableOn, '2026-10-01');
    assert.equal(parts[1]?.tranche, 'twenty');
    assert.equal(parts[1]?.amountInr, 200);
    assert.equal(parts[1]?.payableOn, '2026-11-01');
  });
});
