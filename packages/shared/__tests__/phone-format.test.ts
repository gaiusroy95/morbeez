import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPhoneE164,
  formatPhoneDisplay,
  telHref,
  whatsAppPhone,
} from '../src/format/phone.js';

describe('formatPhoneE164', () => {
  it('adds +91 for 10-digit India numbers', () => {
    assert.equal(formatPhoneE164('6282873542'), '+916282873542');
  });

  it('adds + when country code is already present without plus', () => {
    assert.equal(formatPhoneE164('916282873542'), '+916282873542');
    assert.equal(formatPhoneE164('420771542941'), '+420771542941');
  });

  it('keeps existing plus and strips formatting', () => {
    assert.equal(formatPhoneE164('+91 62828 73542'), '+916282873542');
  });

  it('returns null for empty', () => {
    assert.equal(formatPhoneE164(''), null);
    assert.equal(formatPhoneE164(null), null);
  });
});

describe('display and dial helpers', () => {
  it('formatPhoneDisplay uses em dash when empty', () => {
    assert.equal(formatPhoneDisplay(null), '—');
    assert.equal(formatPhoneDisplay('916282873542'), '+916282873542');
  });

  it('telHref includes plus', () => {
    assert.equal(telHref('916282873542'), 'tel:+916282873542');
  });

  it('whatsAppPhone is digits only', () => {
    assert.equal(whatsAppPhone('916282873542'), '916282873542');
  });
});
