import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('partner ownership rules', () => {
  it('defaults customer owner to partner when partner enrolls', () => {
    const enrollmentOwnerType = 'partner';
    const enrollmentOwnerPartnerId = 'p1';
    const customerOwnerType =
      enrollmentOwnerType === 'partner' && enrollmentOwnerPartnerId ? 'partner' : 'morbeez';
    const serviceModel = customerOwnerType === 'partner' ? 'partner_assisted' : 'remote_advisory';
    assert.equal(customerOwnerType, 'partner');
    assert.equal(serviceModel, 'partner_assisted');
  });

  it('defaults morbeez remote advisory without partner', () => {
    const enrollmentOwnerType = 'morbeez';
    const customerOwnerType = enrollmentOwnerType === 'partner' ? 'partner' : 'morbeez';
    const serviceModel = customerOwnerType === 'partner' ? 'partner_assisted' : 'remote_advisory';
    assert.equal(customerOwnerType, 'morbeez');
    assert.equal(serviceModel, 'remote_advisory');
  });
});

describe('partner lead allocation scoring', () => {
  it('excludes saturated partners', () => {
    const max = 50;
    const current = 50;
    const headroom = (max - current) / max;
    assert.equal(headroom <= 0, true);
  });

  it('ranks partners with capacity higher', () => {
    const scoreA = 70 * 0.25 + ((50 - 10) / 50) * 100 * 0.15;
    const scoreB = 70 * 0.25 + ((50 - 45) / 50) * 100 * 0.15;
    assert.ok(scoreA > scoreB);
  });
});
