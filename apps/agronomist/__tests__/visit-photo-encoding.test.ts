import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../lib/visitPhotoEncoding';

describe('visitPhotoEncoding', () => {
  it('withTimeout resolves with fallback when promise is slow', async () => {
    const result = await withTimeout(
      new Promise<string>((resolve) => setTimeout(() => resolve('late'), 50)),
      5,
      'fallback'
    );
    assert.equal(result, 'fallback');
  });

  it('withTimeout returns promise result when it finishes in time', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 50, 'fallback');
    assert.equal(result, 'ok');
  });
});
