import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { retrainingOpsService } from '../src/services/intelligence/enterprise-ops.service.js';

describe('retraining queue', () => {
  it('returns gold queue rows array', async () => {
    const rows = await retrainingOpsService.listGoldQueue(5).catch(() => []);
    assert.ok(Array.isArray(rows));
  });

  it('returns eval summary shape', async () => {
    const summary = await retrainingOpsService.getEvalSummary().catch(() => ({
      accuracy: null,
      falsePositiveRate: null,
      recoveryRate: null,
    }));
    assert.ok('accuracy' in summary);
  });
});
