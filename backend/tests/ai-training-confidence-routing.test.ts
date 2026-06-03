import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveConfidenceAction,
  shouldAutoSend,
  shouldEscalate,
  mapFollowupToRecommendationOutcome,
} from '../src/domain/ai-training/confidence-routing.js';
import type { StructuredAdvisory } from '../src/services/ai/types.js';

const baseAdvisory: StructuredAdvisory = {
  probableIssue: 'Rhizome rot',
  confidence: 0.8,
  uncertain: false,
  nutrientDeficiency: [],
  stressAnalysis: [],
  treatments: [],
  dosageGuidance: [],
  precautions: [],
  escalationRecommended: false,
  farmerSummaryEn: 'Test',
  farmerSummaryMl: 'പരീക്ഷ',
  recommendedProductTags: [],
};

describe('resolveConfidenceAction', () => {
  it('routes ≥95% to auto_send', () => {
    assert.equal(resolveConfidenceAction(0.96), 'auto_send');
    assert.equal(resolveConfidenceAction(0.95), 'auto_send');
  });

  it('routes 80–94% to employee_review', () => {
    assert.equal(resolveConfidenceAction(0.94), 'employee_review');
    assert.equal(resolveConfidenceAction(0.8), 'employee_review');
  });

  it('routes <80% to escalate', () => {
    assert.equal(resolveConfidenceAction(0.79), 'escalate');
    assert.equal(resolveConfidenceAction(0.5), 'escalate');
  });
});

describe('shouldEscalate (domain routing)', () => {
  it('escalates low confidence', () => {
    assert.equal(shouldEscalate(0.5, baseAdvisory), true);
  });

  it('escalates when AI marks uncertain', () => {
    assert.equal(shouldEscalate(0.9, { ...baseAdvisory, uncertain: true }), true);
  });

  it('does not escalate high confidence clear case in review band', () => {
    assert.equal(shouldEscalate(0.85, baseAdvisory), false);
  });
});

describe('shouldAutoSend', () => {
  it('allows auto-send at 95%+ with clear diagnosis', () => {
    assert.equal(shouldAutoSend(0.96, { ...baseAdvisory, confidence: 0.96 }), true);
  });

  it('blocks auto-send when uncertain', () => {
    assert.equal(shouldAutoSend(0.96, { ...baseAdvisory, uncertain: true }), false);
  });
});

describe('mapFollowupToRecommendationOutcome', () => {
  it('maps improved → better', () => {
    assert.equal(mapFollowupToRecommendationOutcome('improved'), 'better');
  });

  it('maps worsened → no_improvement', () => {
    assert.equal(mapFollowupToRecommendationOutcome('worsened'), 'no_improvement');
  });
});
