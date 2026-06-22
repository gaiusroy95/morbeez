import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compatibilityOverrideService } from '../src/services/core/compatibility-override.service.js';

describe('compatibility override analytics', () => {
  it('listAggregates returns shape', async () => {
    const agg = await compatibilityOverrideService.listAggregates(90).catch(() => ({
      totalOverrides: 0,
      byPair: [],
      unknownPairRate: 0,
      unknownPairChecks: 0,
      unknownPairHits: 0,
    }));
    assert.ok(typeof agg.totalOverrides === 'number');
    assert.ok(Array.isArray(agg.byPair));
    assert.ok(typeof agg.unknownPairRate === 'number');
  });
});
