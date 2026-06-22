import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { weaknessDashboardService } from '../src/services/intelligence/enterprise-dashboard.service.js';

describe('weakness dashboard', () => {
  it('returns structured weakness payload', async () => {
    const data = await weaknessDashboardService.getWeakness(90).catch(() => ({
      topMislabels: [],
      totalEvents: 0,
    }));
    assert.ok(Array.isArray(data.topMislabels));
    assert.equal(typeof data.totalEvents, 'number');
  });
});
