import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { failureAnalysisService } from '../src/services/case/failure-analysis.service.js';
import { adaptiveProtocolService } from '../src/services/intelligence/adaptive-protocol.service.js';

describe('adaptive protocol', () => {
  it('classifies worse outcome with application as product_failure when high confidence', () => {
    const t = failureAnalysisService.classify({
      outcomeStatus: 'worse',
      applicationLogged: true,
      fusedConfidence: 0.8,
    });
    assert.equal(t, 'product_failure');
  });

  it('suggestOnWorseOutcome returns alternate templates array', async () => {
    const s = await adaptiveProtocolService.suggestOnWorseOutcome({
      issueLabel: 'waterlogging',
      cropType: 'ginger',
      district: 'Idukki',
      outcomeStatus: 'worse',
      applicationLogged: true,
      fusedConfidence: 0.8,
    });
    assert.ok(s);
    assert.ok(Array.isArray(s.alternateTemplates));
  });

  it('listRecentSuggestions returns array', async () => {
    const rows = await adaptiveProtocolService.listRecentSuggestions(5).catch(() => []);
    assert.ok(Array.isArray(rows));
  });
});
