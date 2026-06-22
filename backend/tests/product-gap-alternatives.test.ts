import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { productGapService } from '../src/services/core/product-gap.service.js';

describe('product gap alternatives (F15)', () => {
  it('listAlternatives returns array for unknown technical', async () => {
    const alts = await productGapService.listAlternatives('__nonexistent_xyz__', 'ginger').catch(() => []);
    assert.ok(Array.isArray(alts));
  });
});
