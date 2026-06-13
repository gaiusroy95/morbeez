import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';

describe('structured field visits flag', () => {
  it('defaults ENABLE_STRUCTURED_FIELD_VISITS to true', () => {
    assert.equal(env.ENABLE_STRUCTURED_FIELD_VISITS, true);
  });
});
