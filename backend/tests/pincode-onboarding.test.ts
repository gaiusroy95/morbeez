import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePincodeInput } from '../src/services/whatsapp/scenarios/onboarding-flow.service.js';

describe('parsePincodeInput', () => {
  it('accepts any plain 6-digit PIN', () => {
    assert.equal(parsePincodeInput('123456'), '123456');
    assert.equal(parsePincodeInput('999999'), '999999');
  });

  it('strips spaces and punctuation from any PIN', () => {
    assert.equal(parsePincodeInput('PIN: 123-456'), '123456');
    assert.equal(parsePincodeInput('  654321  '), '654321');
  });

  it('rejects wrong length', () => {
    assert.equal(parsePincodeInput('12345'), null);
    assert.equal(parsePincodeInput('1234567'), null);
    assert.equal(parsePincodeInput('hello'), null);
  });
});
