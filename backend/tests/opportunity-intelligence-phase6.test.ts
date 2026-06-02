import { describe, expect, it } from 'vitest';
import { opportunityIntelligenceConfigService } from '../src/services/intelligence/opportunity-intelligence-config.service.js';
import { opportunityIntelligenceAlertsService } from '../src/services/intelligence/opportunity-intelligence-alerts.service.js';
import { opportunityEmployeeLeaderboardsService } from '../src/services/intelligence/opportunity-employee-leaderboards.service.js';
import { FARMER_OPPORTUNITY_WEIGHTS } from '../src/services/intelligence/opportunity-intelligence.types.js';

describe('opportunity-intelligence phase6 refinement', () => {
  it('exports phase6 services', () => {
    expect(opportunityIntelligenceConfigService.get).toBeTypeOf('function');
    expect(opportunityIntelligenceAlertsService.generateDailyAlerts).toBeTypeOf('function');
    expect(opportunityEmployeeLeaderboardsService.listTopRelationshipBuilders).toBeTypeOf('function');
    expect(opportunityEmployeeLeaderboardsService.listHighRetentionEmployees).toBeTypeOf('function');
  });

  it('rescales farmer components when weight cap changes', () => {
    const components = {
      engagement: 10,
      trust: 8,
      acreSize: 12,
      acrePotential: 14,
      relationship: 5,
      advisoryCooperation: 6,
      cropValue: 3,
      referralInfluence: 2,
    };
    const weights = { ...FARMER_OPPORTUNITY_WEIGHTS, engagement: 10 };
    const adjusted = opportunityIntelligenceConfigService.applyFarmerWeightOverrides(
      { ...components, engagement: 20 },
      weights
    );
    expect(adjusted.engagement).toBe(10);
  });

  it('alert service exposes enqueue for CRM actions', () => {
    expect(opportunityIntelligenceAlertsService.enqueueRetentionTasks).toBeTypeOf('function');
    expect(opportunityIntelligenceAlertsService.list).toBeTypeOf('function');
  });
});
