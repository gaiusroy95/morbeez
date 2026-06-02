import { describe, expect, it } from 'vitest';
import { opportunityIntelligenceDashboardService } from '../src/services/intelligence/opportunity-intelligence-dashboard.service.js';
import { opportunityIntelligenceDashboardService as fromIndex } from '../src/services/intelligence/index.js';
import { MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD } from '../src/services/intelligence/employee-performance-scoring.util.js';

describe('opportunity-intelligence phase5 dashboards', () => {
  it('re-exports dashboard service from intelligence index', () => {
    expect(fromIndex).toBe(opportunityIntelligenceDashboardService);
  });

  it('exposes dashboard service methods', () => {
    expect(opportunityIntelligenceDashboardService.getOverview).toBeTypeOf('function');
    expect(opportunityIntelligenceDashboardService.getDistrictHeatmap).toBeTypeOf('function');
    expect(opportunityIntelligenceDashboardService.listTopFarmers).toBeTypeOf('function');
    expect(opportunityIntelligenceDashboardService.listAtRiskFarmers).toBeTypeOf('function');
    expect(opportunityIntelligenceDashboardService.getFarmerProfile).toBeTypeOf('function');
    expect(opportunityIntelligenceDashboardService.listEmployeeLeaderboard).toBeTypeOf('function');
    expect(opportunityIntelligenceDashboardService.getEventVolumeByType).toBeTypeOf('function');
  });

  it('employee leaderboard uses same minimum attribution threshold as phase 4', () => {
    expect(MIN_ATTRIBUTED_FARMERS_FOR_LEADERBOARD).toBe(10);
  });
});
