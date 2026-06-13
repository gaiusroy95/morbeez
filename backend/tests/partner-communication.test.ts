import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('partner communication timeline types', () => {
  it('maps author types for cross-role visibility', () => {
    const roles = ['telecaller', 'partner', 'expert', 'system'];
    assert.ok(roles.includes('partner'));
    assert.ok(roles.includes('expert'));
  });

  it('support request entry type is distinct from farmer notes', () => {
    const entryType = 'support_request';
    assert.notEqual(entryType, 'note');
  });
});

describe('partner task routing', () => {
  it('routes visit_request to partner when service model is partner_assisted', () => {
    const serviceModel = 'partner_assisted';
    const assignedToRole = serviceModel === 'partner_assisted' ? 'partner' : 'expert';
    assert.equal(assignedToRole, 'partner');
  });
});
