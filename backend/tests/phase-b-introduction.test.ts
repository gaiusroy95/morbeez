import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTRODUCTION_RULE,
  evaluateIntroduction,
} from '../src/domain/remuneration/introduction-eligibility.js';
import {
  consumeProductReward,
  productRewardBalance,
  restoreProductReward,
} from '../src/domain/remuneration/product-reward.js';

const PASS = {
  newFarmer: true,
  duplicateMobile: false,
  duplicatePartnerClaim: false,
  acreage: 2,
  farmerVerified: true,
  fieldVerified: true,
  evidenceComplete: true,
  agronomistEngaged: true,
  fraud: false,
};

describe('farmer introduction eligibility', () => {
  it('pays ₹100 cash and unlocks ₹400 product when every gate passes', () => {
    const r = evaluateIntroduction(PASS);
    assert.equal(r.status, 'eligible');
    assert.equal(r.cashAmount, 100);
    assert.equal(r.productMax, 400);
  });

  it('stays pending below 2 acres', () => {
    const r = evaluateIntroduction({ ...PASS, acreage: 1.9 });
    assert.equal(r.status, 'pending');
    assert.ok(r.reasons.includes('min_acreage'));
    assert.equal(r.cashEligible, false);
  });

  it('rejects duplicate mobile and duplicate partner claims', () => {
    assert.equal(evaluateIntroduction({ ...PASS, duplicateMobile: true }).status, 'rejected');
    assert.equal(evaluateIntroduction({ ...PASS, duplicatePartnerClaim: true }).status, 'rejected');
  });

  it('sends existing farmers to review instead of paying', () => {
    const r = evaluateIntroduction({ ...PASS, newFarmer: false });
    assert.equal(r.status, 'review');
    assert.equal(r.cashEligible, false);
  });

  it('holds fraud', () => {
    assert.equal(evaluateIntroduction({ ...PASS, fraud: true }).status, 'fraud_hold');
  });

  it('reads min acreage and amounts from the rule version', () => {
    const r = evaluateIntroduction(PASS, { ...DEFAULT_INTRODUCTION_RULE, minAcreage: 5, cashRewardInr: 150 });
    assert.equal(r.status, 'pending');
    const ok = evaluateIntroduction({ ...PASS, acreage: 5 }, {
      ...DEFAULT_INTRODUCTION_RULE,
      cashRewardInr: 150,
      productRewardInr: 500,
    });
    assert.equal(ok.cashAmount, 150);
    assert.equal(ok.productMax, 500);
  });
});

describe('₹400 product wallet', () => {
  it('consumes from actual purchases and never converts leftover to cash', () => {
    const first = consumeProductReward({ maxInr: 400, usedInr: 0, purchaseInr: 260 });
    assert.equal(first.consumeInr, 260);
    assert.equal(first.balanceInr, 140);
    const leftover = consumeProductReward({
      maxInr: 400,
      usedInr: first.usedInr,
      purchaseInr: 0,
    });
    assert.equal(leftover.consumeInr, 0);
    assert.equal(leftover.balanceInr, 140);
    assert.equal(productRewardBalance(400, 260), 140);
  });

  it('caps at remaining wallet', () => {
    const r = consumeProductReward({ maxInr: 400, usedInr: 350, purchaseInr: 200 });
    assert.equal(r.consumeInr, 50);
    assert.equal(r.balanceInr, 0);
  });

  it('restores usage when a product order is returned', () => {
    const r = restoreProductReward({ maxInr: 400, usedInr: 260, restoreInr: 260 });
    assert.equal(r.restoreInr, 260);
    assert.equal(r.usedInr, 0);
    assert.equal(r.balanceInr, 400);
  });
});
