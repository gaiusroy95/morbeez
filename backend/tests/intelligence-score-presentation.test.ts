import { describe, expect, it } from 'vitest';
import {
  buildFarmerMetrics100,
  classifyFarmer,
  buildFarmerScorePresentation,
  buildEmployeeScorePresentation,
  classifyEmployee,
  detectFarmerSignalsFromEvents,
} from '../src/services/intelligence/intelligence-score-presentation.service.js';
import { FARMER_OPPORTUNITY_WEIGHTS } from '../src/services/intelligence/opportunity-intelligence.types.js';
import { EMPLOYEE_PERFORMANCE_WEIGHTS } from '../src/services/intelligence/opportunity-intelligence.types.js';
import type { FarmerScoreComponents } from '../src/services/intelligence/opportunity-intelligence.types.js';
import type { FarmerEventRow } from '../src/services/intelligence/farmer-event.types.js';

function premiumComponents(): FarmerScoreComponents {
  return {
    engagement: 18,
    trust: 13,
    acreSize: 12,
    acrePotential: 16,
    relationship: 9,
    advisoryCooperation: 9,
    cropValue: 4,
    referralInfluence: 3,
  };
}

function weakRetentionComponents(): FarmerScoreComponents {
  return {
    engagement: 7,
    trust: 7,
    acreSize: 14,
    acrePotential: 14,
    relationship: 4,
    advisoryCooperation: 4,
    cropValue: 4,
    referralInfluence: 1,
  };
}

describe('intelligence-score-presentation', () => {
  it('normalizes farmer metrics to 0–100', () => {
    const metrics = buildFarmerMetrics100(premiumComponents(), 89);
    const eng = metrics.find((m) => m.key === 'engagement')!;
    expect(eng.score).toBe(Math.round((18 / FARMER_OPPORTUNITY_WEIGHTS.engagement) * 100));
    expect(metrics.find((m) => m.key === 'retentionStability')!.score).toBe(89);
  });

  it('classifies premium high-ROI farmer', () => {
    const metrics = buildFarmerMetrics100(premiumComponents(), 89);
    expect(classifyFarmer(88, metrics)).toBe('Premium High-ROI Farmer');
  });

  it('classifies weak long-term relationship when acre high but engagement low', () => {
    const metrics = buildFarmerMetrics100(weakRetentionComponents(), 31);
    expect(classifyFarmer(53, metrics)).toBe('Weak Long-Term Relationship');
  });

  it('classifies short-term sales employee', () => {
    const metrics = [
      { key: 'engagementGrowth', label: 'Engagement Growth', score: 42, max: 100 },
      { key: 'relationshipQuality', label: 'Relationship Quality', score: 35, max: 100 },
      { key: 'retentionQuality', label: 'Retention Quality', score: 28, max: 100 },
      { key: 'trustBuilding', label: 'Trust Building', score: 40, max: 100 },
      { key: 'delayedConversion', label: 'Delayed Conversion Influence', score: 31, max: 100 },
      { key: 'farmerReactivation', label: 'Farmer Reactivation', score: 15, max: 100 },
    ];
    expect(classifyEmployee(38, metrics)).toBe('Short-Term Sales Employee');
  });

  it('builds employee presentation with business insight', () => {
    const pres = buildEmployeeScorePresentation({
      employeeProfileId: 'e1',
      performanceScore: 89,
      attributedFarmerCount: 12,
      factors: [],
      engineVersion: 'v1',
      calculatedAt: new Date().toISOString(),
      components: {
        engagementGrowth: Math.round(EMPLOYEE_PERFORMANCE_WEIGHTS.engagementGrowth * 0.92),
        relationshipQuality: Math.round(EMPLOYEE_PERFORMANCE_WEIGHTS.relationshipQuality * 0.89),
        retentionQuality: Math.round(EMPLOYEE_PERFORMANCE_WEIGHTS.retentionQuality * 0.86),
        trustBuilding: Math.round(EMPLOYEE_PERFORMANCE_WEIGHTS.trustBuilding * 0.81),
        delayedConversion: Math.round(EMPLOYEE_PERFORMANCE_WEIGHTS.delayedConversion * 0.84),
        farmerReactivation: Math.round(EMPLOYEE_PERFORMANCE_WEIGHTS.farmerReactivation * 0.95),
      },
    });
    expect(pres.classification).toBe('Long-Term High-Value Employee');
    expect(pres.businessInsight).toContain('strongest future farmers');
    expect(pres.metrics).toHaveLength(6);
  });

  it('detects signals from events', () => {
    const events: FarmerEventRow[] = [
      {
        id: '1',
        farmerId: 'f1',
        employeeProfileId: null,
        eventType: 'IMAGE_UPLOAD',
        eventValue: {},
        source: 'whatsapp',
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        farmerId: 'f1',
        employeeProfileId: null,
        eventType: 'ROI_ENTRY',
        eventValue: {},
        source: 'roi',
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    const sig = detectFarmerSignalsFromEvents(events);
    expect(sig.positive).toContain('Uploads crop images regularly');
    expect(sig.positive).toContain('Uses ROI tracker');
  });

  it('builds full farmer presentation', () => {
    const pres = buildFarmerScorePresentation({
      score: {
        farmerId: 'f1',
        opportunityScore: 88,
        components: premiumComponents(),
        factors: [],
        engineVersion: 'v1',
        calculatedAt: new Date().toISOString(),
      },
      retentionScore100: 89,
      recentEvents: [],
    });
    expect(pres.metrics).toHaveLength(6);
    expect(pres.classification).toBe('Premium High-ROI Farmer');
    expect(pres.businessInsight).toContain('retention');
  });
});
