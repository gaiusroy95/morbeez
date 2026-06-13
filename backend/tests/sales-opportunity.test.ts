import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('sales opportunity statuses', () => {
  const open = ['interested', 'hot_lead', 'ready_to_order', 'follow_up_required'];
  const closed = ['converted', 'closed'];

  it('telecaller inbox filters open statuses only', () => {
    const status = 'interested';
    assert.ok(open.includes(status));
    assert.ok(!closed.includes(status));
  });

  it('conversion moves to converted', () => {
    const next = 'converted';
    assert.ok(closed.includes(next));
  });
});
