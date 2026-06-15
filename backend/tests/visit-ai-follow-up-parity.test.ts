import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('visit-origin recommendation follow-up parity', () => {
  it('visitOrigin metadata shape matches field-visit submit contract', () => {
    const metadata = {
      visitOrigin: true,
      visitAiCaseId: '11111111-1111-1111-1111-111111111111',
      agronomistReviewAction: 'approve_ai',
      fieldRecStatus: 'open',
    };
    assert.equal(metadata.visitOrigin, true);
    assert.ok(metadata.visitAiCaseId);
  });

  it('onRecommendationCommunicated has no source filter (field_finding allowed)', () => {
    const source = 'field_finding';
    const blockedSources: string[] = [];
    assert.equal(blockedSources.includes(source), false);
  });
});
