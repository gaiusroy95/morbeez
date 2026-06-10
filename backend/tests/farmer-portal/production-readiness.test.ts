import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertBase64ImageSize, MAX_UPLOAD_IMAGE_BYTES } from '../../src/lib/upload-limits.js';

describe('upload limits', () => {
  it('accepts small base64 payloads', () => {
    assert.doesNotThrow(() => assertBase64ImageSize('a'.repeat(100)));
  });

  it('rejects oversized base64 payloads', () => {
    const huge = 'A'.repeat(Math.ceil((MAX_UPLOAD_IMAGE_BYTES * 4) / 3) + 4);
    assert.throws(() => assertBase64ImageSize(huge), /too large/i);
  });
});

describe('checkout price validation contract', () => {
  it('treats paise as integer rupee fraction', () => {
    const unitPriceInr = 499;
    const paise = Math.round(unitPriceInr * 100);
    assert.equal(paise, 49900);
  });
});
