import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApplicationFollowUpContext,
  contextFromRecommendationRecord,
  formatApplicationCheckMessage,
  summarizeDosageGuidance,
  summarizeFromRecommendationFields,
} from '../src/services/core/application-follow-up-message.util.js';

describe('application follow-up message', () => {
  it('includes issue, date, and foliar summary in the prompt', () => {
    const ctx = buildApplicationFollowUpContext({
      lang: 'en',
      issueLabel: 'Anthracnose',
      recommendedAt: '2025-07-10T10:00:00.000Z',
      summary: 'Copper oxychloride 2 g/L (foliar spray)',
    });

    const body = formatApplicationCheckMessage('en', ctx);
    assert.match(body, /Anthracnose/);
    assert.match(body, /Jul/);
    assert.match(body, /Copper oxychloride/);
    assert.match(body, /Have you applied this recommendation/);
  });

  it('summarizes dosage guidance for foliar recommendations', () => {
    const summary = summarizeDosageGuidance([
      { product: 'Mancozeb', rate: '2 g/L', method: 'foliar spray on leaves' },
    ]);
    assert.match(summary, /Mancozeb/);
    assert.match(summary, /foliar spray on leaves/);
  });

  it('builds context from recommendation record fields', () => {
    const ctx = contextFromRecommendationRecord(
      {
        issue_detected: 'Leaf spot',
        communicated_at: '2025-06-01T08:00:00.000Z',
        dosage: 'Spray 2 g/L in 200 L water',
        trade_name: 'Copper fungicide',
      },
      'en'
    );

    assert.equal(ctx.issueLabel, 'Leaf spot');
    assert.match(ctx.summary, /Spray 2 g\/L/);
    assert.match(ctx.summary, /Copper fungicide/);
  });

  it('falls back to recommendation text when dosage is missing', () => {
    const summary = summarizeFromRecommendationFields({
      recommendation_text:
        'Apply foliar spray in the evening. Repeat after 10 days if spots persist.',
    });
    assert.match(summary, /foliar spray/i);
  });
});
