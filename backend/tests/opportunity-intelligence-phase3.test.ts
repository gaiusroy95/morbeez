import { describe, expect, it } from 'vitest';
import {
  computeFarmerScoreComponents,
  computeRetentionRisk,
  scoreEngagement,
  scoreTrust,
  scoreAcreSize,
  scoreAcrePotential,
  scoreCropValue,
} from '../src/services/intelligence/farmer-opportunity-scoring.util.js';
import { FARMER_OPPORTUNITY_WEIGHTS } from '../src/services/intelligence/opportunity-intelligence.types.js';

describe('opportunity-intelligence phase3 scoring', () => {
  it('engagement caps at 20 points', () => {
    const { score } = scoreEngagement({
      inboundCount30d: 50,
      richMediaCount30d: 10,
      outboundCount30d: 20,
    });
    expect(score).toBeLessThanOrEqual(FARMER_OPPORTUNITY_WEIGHTS.engagement);
    expect(score).toBe(FARMER_OPPORTUNITY_WEIGHTS.engagement);
  });

  it('trust accumulates from ROI and orders', () => {
    const { score, factors } = scoreTrust({
      roiEntryCount90d: 2,
      recommendationsApplied90d: 1,
      ordersConverted180d: 1,
      positiveOutcomes90d: 0,
    });
    expect(score).toBeGreaterThan(10);
    expect(factors.some((f) => f.code === 'trust_order')).toBe(true);
  });

  it('acre size tiers map correctly', () => {
    expect(scoreAcreSize(0.5).score).toBe(3);
    expect(scoreAcreSize(5).score).toBe(11);
    expect(scoreAcreSize(12).score).toBe(15);
  });

  it('high-value crop scores higher than unknown', () => {
    expect(scoreCropValue('cardamom').score).toBe(5);
    expect(scoreCropValue('rice').score).toBe(2);
  });

  it('acre potential uses soil and field visit signals', () => {
    const base = scoreAcrePotential({
      totalAcreage: null,
      blockCount: 0,
      primaryCrop: null,
      hasAssignedLead: false,
      soilReports90d: 0,
      fieldFindings90d: 0,
      healthyBlockRatio: null,
    });
    const enriched = scoreAcrePotential({
      totalAcreage: 3,
      blockCount: 2,
      primaryCrop: 'banana',
      hasAssignedLead: true,
      soilReports90d: 2,
      fieldFindings90d: 1,
      healthyBlockRatio: 1,
    });
    expect(base.score).toBe(0);
    expect(enriched.score).toBeGreaterThan(10);
    expect(enriched.factors.some((f) => f.code === 'potential_soil_data')).toBe(true);
  });

  it('full components sum to opportunity score max 100', () => {
    const { components } = computeFarmerScoreComponents({
      engagement: { inboundCount30d: 20, richMediaCount30d: 3, outboundCount30d: 10 },
      trust: {
        roiEntryCount90d: 3,
        recommendationsApplied90d: 1,
        ordersConverted180d: 1,
        positiveOutcomes90d: 1,
      },
      profile: {
        totalAcreage: 12,
        blockCount: 2,
        primaryCrop: 'cardamom',
        hasAssignedLead: true,
        soilReports90d: 1,
        fieldFindings90d: 2,
        healthyBlockRatio: 0.5,
      },
      relationship: {
        activeAttributionTouches30d: 1,
        crmFollowUps30d: 2,
        hasAssignedLead: true,
      },
      advisory: {
        recommendationsCommunicated90d: 2,
        recommendationsApplied90d: 1,
        advisorySessions90d: 3,
      },
      referral: { referralSource: 'farmer_referral', campaignSource: 'diwali_2025' },
    });

    const total =
      components.engagement +
      components.trust +
      components.acreSize +
      components.acrePotential +
      components.relationship +
      components.advisoryCooperation +
      components.cropValue +
      components.referralInfluence;

    expect(total).toBeLessThanOrEqual(100);
    expect(total).toBeGreaterThan(40);
  });

  it('retention risk bands by days since inbound', () => {
    expect(computeRetentionRisk(3).riskBand).toBe('healthy');
    expect(computeRetentionRisk(10).riskBand).toBe('watch');
    expect(computeRetentionRisk(20).riskBand).toBe('at_risk');
    expect(computeRetentionRisk(45).riskBand).toBe('churned');
  });
});
