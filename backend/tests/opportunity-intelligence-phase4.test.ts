import { describe, expect, it } from 'vitest';
import { EMPLOYEE_PERFORMANCE_WEIGHTS } from '../src/services/intelligence/opportunity-intelligence.types.js';
import {
  MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD,
  computeEmployeeScoreComponents,
  performanceBreakdownFromComponents,
  performanceLabel,
} from '../src/services/intelligence/employee-performance-scoring.util.js';

describe('opportunity-intelligence phase4 employee performance', () => {
  it('employee performance weights sum to 100', () => {
    const sum = Object.values(EMPLOYEE_PERFORMANCE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('leaderboard requires at least 10 attributed farmers', () => {
    expect(MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD).toBe(10);
  });

  it('computes total performance score capped at 100', () => {
    const { components } = computeEmployeeScoreComponents({
      attributedFarmerCount: 15,
      inboundEvents30d: 25,
      inboundEventsPrev30d: 10,
      outboundEvents30d: 30,
      crmTasksCompleted30d: 5,
      avgFarmerRelationshipScore: 8,
      avgFarmerOpportunityScore: 55,
      healthyRetentionPct: 0.8,
      trustEvents90d: 4,
      conversionAssists180d: 2,
      reactivations90d: 1,
      recommendationsApproved90d: 3,
      recommendationsCommunicated90d: 4,
      positiveOutcomes90d: 2,
      activityEvidence30d: 10,
    });

    const total =
      components.engagementGrowth +
      components.relationshipQuality +
      components.retentionQuality +
      components.trustBuilding +
      components.delayedConversion +
      components.farmerReactivation +
      components.knowledgeContribution +
      components.farmerSatisfaction;

    expect(total).toBeLessThanOrEqual(100);
    expect(total).toBeGreaterThan(30);
  });

  it('breakdown has eight components', () => {
    const { components } = computeEmployeeScoreComponents({
      attributedFarmerCount: 0,
      inboundEvents30d: 0,
      inboundEventsPrev30d: 0,
      outboundEvents30d: 0,
      crmTasksCompleted30d: 0,
      avgFarmerRelationshipScore: null,
      avgFarmerOpportunityScore: null,
      healthyRetentionPct: null,
      trustEvents90d: 0,
      conversionAssists180d: 0,
      reactivations90d: 0,
      recommendationsApproved90d: 0,
      recommendationsCommunicated90d: 0,
      positiveOutcomes90d: 0,
      activityEvidence30d: 0,
    });
    expect(performanceBreakdownFromComponents(components)).toHaveLength(8);
  });

  it('maps score to performance labels', () => {
    expect(performanceLabel(92)).toBe('Excellent');
    expect(performanceLabel(75)).toBe('Good');
    expect(performanceLabel(55)).toBe('Needs improvement');
  });
});
