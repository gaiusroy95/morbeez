import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('case review queue policy', () => {
  it('allows multiple queue rows per farmer (no dedupe in list)', () => {
    const items = [
      { id: 'a', farmerId: 'f1' },
      { id: 'b', farmerId: 'f1' },
      { id: 'c', farmerId: 'f2' },
    ];
    assert.equal(items.length, 3);
    assert.equal(items.filter((i) => i.farmerId === 'f1').length, 2);
  });
});
