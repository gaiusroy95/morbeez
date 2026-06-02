import { describe, expect, it } from 'vitest';
import { buildFarmerSummary } from '../src/services/intelligence/opportunity-intelligence-dashboard.service.js';
import type { FarmerScoreSnapshot } from '../src/services/intelligence/opportunity-score-store.service.js';

describe('buildFarmerSummary', () => {
  it('maps component scores to human-readable tiers', () => {
    const score: FarmerScoreSnapshot = {
      opportunityScore: 84,
      calculatedAt: new Date().toISOString(),
      components: {
        engagement: 16,
        trust: 12,
        acreSize: 10,
        acrePotential: 14,
        relationship: 8,
        advisoryCooperation: 8,
        cropValue: 4,
        referralInfluence: 2,
      },
      factors: [],
    };

    const summary = buildFarmerSummary(score, {
      riskBand: 'healthy',
      retentionScore: 88,
      daysSinceLastInbound: 2,
      calculatedAt: new Date().toISOString(),
    });

    expect(summary?.opportunityLevel).toBe('High');
    expect(summary?.engagementLevel).toBe('High');
    expect(summary?.trustLevel).toBe('Strong');
    expect(summary?.retentionRiskLabel).toBe('Low');
  });
});
