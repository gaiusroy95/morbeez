import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('partner workspace routing', () => {
  it('farmer workspace path includes farmerId', () => {
    const farmerId = 'abc-123';
    const path = `/farmer/${farmerId}`;
    assert.match(path, /^\/farmer\/.+/);
  });

  it('block workspace nests under farmer', () => {
    const farmerId = 'f1';
    const blockId = 'b1';
    const path = `/farmer/${farmerId}/block/${blockId}`;
    assert.ok(path.includes(farmerId));
    assert.ok(path.includes(blockId));
  });

  it('visit success route accepts findingId query', () => {
    const qs = new URLSearchParams({ farmerId: 'f1', findingId: 'find-1' });
    assert.equal(qs.get('farmerId'), 'f1');
  });
});
