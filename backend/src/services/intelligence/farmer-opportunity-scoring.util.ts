import { FARMER_OPPORTUNITY_WEIGHTS } from './opportunity-intelligence.types.js';
import type { FarmerScoreComponents, ScoreFactor } from './opportunity-intelligence.types.js';

export const HIGH_VALUE_CROPS = new Set([
  'pepper',
  'cardamom',
  'ginger',
  'banana',
  'coconut',
  'arecanut',
  'rubber',
  'grapes',
  'pomegranate',
  'nutmeg',
  'coffee',
  'cocoa',
]);

export type FarmerEngagementSignals = {
  inboundCount30d: number;
  richMediaCount30d: number;
  outboundCount30d: number;
};

export type FarmerTrustSignals = {
  roiEntryCount90d: number;
  recommendationsApplied90d: number;
  ordersConverted180d: number;
  positiveOutcomes90d: number;
};

export type FarmerProfileSignals = {
  totalAcreage: number | null;
  blockCount: number;
  primaryCrop: string | null;
  hasAssignedLead: boolean;
  soilReports90d: number;
  fieldFindings90d: number;
  healthyBlockRatio: number | null;
};

export type FarmerRelationshipSignals = {
  activeAttributionTouches30d: number;
  crmFollowUps30d: number;
  hasAssignedLead: boolean;
};

export type FarmerAdvisorySignals = {
  recommendationsCommunicated90d: number;
  recommendationsApplied90d: number;
  advisorySessions90d: number;
};

export type FarmerReferralSignals = {
  referralSource: string | null;
  campaignSource: string | null;
};

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

export function scoreEngagement(
  signals: FarmerEngagementSignals
): { score: number; factors: ScoreFactor[] } {
  const max = FARMER_OPPORTUNITY_WEIGHTS.engagement;
  const factors: ScoreFactor[] = [];
  let raw = 0;

  if (signals.inboundCount30d === 0) {
    factors.push({ code: 'engagement_quiet', label: 'No farmer replies in the last 30 days', delta: 0 });
    return { score: 0, factors };
  }

  if (signals.inboundCount30d <= 2) raw = 5;
  else if (signals.inboundCount30d <= 5) raw = 10;
  else if (signals.inboundCount30d <= 10) raw = 15;
  else raw = 20;

  if (signals.richMediaCount30d > 0) {
    raw += Math.min(4, signals.richMediaCount30d);
    factors.push({
      code: 'engagement_media',
      label: 'Photos or voice notes shared',
      delta: Math.min(4, signals.richMediaCount30d),
      evidence: { count: signals.richMediaCount30d },
    });
  }

  const score = clamp(raw, max);
  factors.push({
    code: 'engagement_inbound',
    label: `${signals.inboundCount30d} inbound messages (30d)`,
    delta: score,
    evidence: { inboundCount30d: signals.inboundCount30d },
  });
  return { score, factors };
}

export function scoreTrust(signals: FarmerTrustSignals): { score: number; factors: ScoreFactor[] } {
  const max = FARMER_OPPORTUNITY_WEIGHTS.trust;
  const factors: ScoreFactor[] = [];
  let raw = 0;

  if (signals.roiEntryCount90d > 0) {
    const pts = Math.min(9, signals.roiEntryCount90d * 3);
    raw += pts;
    factors.push({
      code: 'trust_roi',
      label: 'ROI ledger entries',
      delta: pts,
      evidence: { count: signals.roiEntryCount90d },
    });
  }

  if (signals.recommendationsApplied90d > 0) {
    raw += 4;
    factors.push({
      code: 'trust_applied_rec',
      label: 'Applied agronomist recommendations',
      delta: 4,
    });
  }

  if (signals.ordersConverted180d > 0) {
    raw += 5;
    factors.push({
      code: 'trust_order',
      label: 'Converted to a paid order',
      delta: 5,
      evidence: { orders: signals.ordersConverted180d },
    });
  }

  if (signals.positiveOutcomes90d > 0) {
    raw += 3;
    factors.push({
      code: 'trust_outcome',
      label: 'Reported better crop outcomes',
      delta: 3,
    });
  }

  return { score: clamp(raw, max), factors };
}

export function scoreAcreSize(totalAcreage: number | null): { score: number; factors: ScoreFactor[] } {
  const max = FARMER_OPPORTUNITY_WEIGHTS.acreSize;
  const factors: ScoreFactor[] = [];
  if (totalAcreage == null || totalAcreage <= 0) {
    return {
      score: 0,
      factors: [{ code: 'acre_unknown', label: 'Farm size not recorded', delta: 0 }],
    };
  }

  let score = 0;
  if (totalAcreage < 1) score = 3;
  else if (totalAcreage < 3) score = 7;
  else if (totalAcreage < 10) score = 11;
  else score = 15;

  factors.push({
    code: 'acre_size',
    label: `${totalAcreage.toFixed(1)} acres registered`,
    delta: clamp(score, max),
    evidence: { totalAcreage },
  });
  return { score: clamp(score, max), factors };
}

export function scoreAcrePotential(profile: FarmerProfileSignals): { score: number; factors: ScoreFactor[] } {
  const max = FARMER_OPPORTUNITY_WEIGHTS.acrePotential;
  const factors: ScoreFactor[] = [];
  let raw = 0;

  if (profile.blockCount > 0) {
    raw += 8;
    factors.push({ code: 'potential_blocks', label: 'Crop blocks on file', delta: 8 });
  }
  if (profile.blockCount >= 2) {
    raw += 5;
    factors.push({ code: 'potential_multi_block', label: 'Multiple crop blocks', delta: 5 });
  }
  if (profile.totalAcreage != null && profile.totalAcreage > 0) {
    raw += 5;
    factors.push({ code: 'potential_acreage', label: 'Acreage captured', delta: 5 });
  }
  if (profile.primaryCrop) {
    raw += 2;
    factors.push({
      code: 'potential_crop',
      label: `Primary crop: ${profile.primaryCrop}`,
      delta: 2,
    });
  }

  if (profile.soilReports90d > 0) {
    raw += Math.min(4, profile.soilReports90d);
    factors.push({
      code: 'potential_soil_data',
      label: `${profile.soilReports90d} soil report(s) on file (90d)`,
      delta: Math.min(4, profile.soilReports90d),
    });
  }

  if (profile.fieldFindings90d > 0) {
    raw += Math.min(3, profile.fieldFindings90d);
    factors.push({
      code: 'potential_field_visits',
      label: `${profile.fieldFindings90d} field visit(s) logged (90d)`,
      delta: Math.min(3, profile.fieldFindings90d),
    });
  }

  if (profile.healthyBlockRatio != null && profile.healthyBlockRatio >= 0.5) {
    raw += 3;
    factors.push({
      code: 'potential_block_health',
      label: 'Healthy block soil status on file',
      delta: 3,
      evidence: { healthyBlockRatio: profile.healthyBlockRatio },
    });
  }

  return { score: clamp(raw, max), factors };
}

export function scoreRelationship(
  signals: FarmerRelationshipSignals
): { score: number; factors: ScoreFactor[] } {
  const max = FARMER_OPPORTUNITY_WEIGHTS.relationship;
  const factors: ScoreFactor[] = [];
  let raw = 0;

  if (signals.hasAssignedLead) {
    raw += 3;
    factors.push({ code: 'relationship_assigned', label: 'Assigned telecaller lead', delta: 3 });
  }
  if (signals.activeAttributionTouches30d > 0) {
    raw += 4;
    factors.push({
      code: 'relationship_attribution',
      label: 'Active relationship attribution (30d)',
      delta: 4,
    });
  }
  if (signals.crmFollowUps30d > 0) {
    raw += Math.min(3, signals.crmFollowUps30d);
    factors.push({
      code: 'relationship_crm',
      label: 'CRM follow-ups completed',
      delta: Math.min(3, signals.crmFollowUps30d),
    });
  }

  return { score: clamp(raw, max), factors };
}

export function scoreAdvisoryCooperation(
  signals: FarmerAdvisorySignals
): { score: number; factors: ScoreFactor[] } {
  const max = FARMER_OPPORTUNITY_WEIGHTS.advisoryCooperation;
  const factors: ScoreFactor[] = [];
  let raw = 0;

  if (signals.recommendationsCommunicated90d > 0) {
    raw += 4;
    factors.push({ code: 'advisory_communicated', label: 'Recommendations sent to farmer', delta: 4 });
  }
  if (signals.recommendationsApplied90d > 0) {
    raw += 3;
    factors.push({ code: 'advisory_applied', label: 'Farmer applied recommendations', delta: 3 });
  }
  if (signals.advisorySessions90d > 0) {
    raw += 3;
    factors.push({
      code: 'advisory_sessions',
      label: 'Crop Doctor / advisory sessions',
      delta: 3,
      evidence: { count: signals.advisorySessions90d },
    });
  }

  return { score: clamp(raw, max), factors };
}

export function scoreCropValue(primaryCrop: string | null): { score: number; factors: ScoreFactor[] } {
  const max = FARMER_OPPORTUNITY_WEIGHTS.cropValue;
  if (!primaryCrop) {
    return { score: 0, factors: [{ code: 'crop_unknown', label: 'Crop type unknown', delta: 0 }] };
  }
  const normalized = primaryCrop.toLowerCase().trim();
  const isHigh = HIGH_VALUE_CROPS.has(normalized);
  const score = isHigh ? 5 : 2;
  return {
    score: clamp(score, max),
    factors: [
      {
        code: isHigh ? 'crop_high_value' : 'crop_standard',
        label: isHigh ? `High-value crop (${primaryCrop})` : `Crop: ${primaryCrop}`,
        delta: score,
      },
    ],
  };
}

export function scoreReferralInfluence(
  signals: FarmerReferralSignals
): { score: number; factors: ScoreFactor[] } {
  const max = FARMER_OPPORTUNITY_WEIGHTS.referralInfluence;
  const factors: ScoreFactor[] = [];
  let raw = 0;

  const ref = (signals.referralSource ?? '').toLowerCase();
  if (ref && ref !== 'whatsapp' && ref !== 'organic') {
    raw += 3;
    factors.push({
      code: 'referral_source',
      label: `Referral source: ${signals.referralSource}`,
      delta: 3,
    });
  }
  if (signals.campaignSource) {
    raw += 2;
    factors.push({
      code: 'campaign_source',
      label: `Campaign: ${signals.campaignSource}`,
      delta: 2,
    });
  }

  return { score: clamp(raw, max), factors };
}

export function computeFarmerScoreComponents(input: {
  engagement: FarmerEngagementSignals;
  trust: FarmerTrustSignals;
  profile: FarmerProfileSignals;
  relationship: FarmerRelationshipSignals;
  advisory: FarmerAdvisorySignals;
  referral: FarmerReferralSignals;
}): { components: FarmerScoreComponents; factors: ScoreFactor[] } {
  const e = scoreEngagement(input.engagement);
  const t = scoreTrust(input.trust);
  const aSize = scoreAcreSize(input.profile.totalAcreage);
  const aPot = scoreAcrePotential(input.profile);
  const r = scoreRelationship(input.relationship);
  const adv = scoreAdvisoryCooperation(input.advisory);
  const crop = scoreCropValue(input.profile.primaryCrop);
  const ref = scoreReferralInfluence(input.referral);

  let components: FarmerScoreComponents = {
    engagement: e.score,
    trust: t.score,
    acreSize: aSize.score,
    acrePotential: aPot.score,
    relationship: r.score,
    advisoryCooperation: adv.score,
    cropValue: crop.score,
    referralInfluence: ref.score,
  };

  components = applyFarmerBehavioralModifiers(components, {
    engagement: input.engagement,
    trust: input.trust,
    relationship: input.relationship,
    referral: input.referral,
    advisory: input.advisory,
  });

  return {
    components,
    factors: [...e.factors, ...t.factors, ...aSize.factors, ...aPot.factors, ...r.factors, ...adv.factors, ...crop.factors, ...ref.factors],
  };
}

/** Aligns scores with real archetypes: fast buyer / quiet farmer, referral trust, etc. */
export function applyFarmerBehavioralModifiers(
  components: FarmerScoreComponents,
  input: {
    engagement: FarmerEngagementSignals;
    trust: FarmerTrustSignals;
    relationship: FarmerRelationshipSignals;
    referral: FarmerReferralSignals;
    advisory: FarmerAdvisorySignals;
  }
): FarmerScoreComponents {
  const next = { ...components };

  const quietButBought =
    input.trust.ordersConverted180d > 0 && input.engagement.inboundCount30d <= 2;
  if (quietButBought) {
    next.trust = Math.min(next.trust, Math.floor(FARMER_OPPORTUNITY_WEIGHTS.trust * 0.55));
    next.relationship = Math.min(
      next.relationship,
      Math.floor(FARMER_OPPORTUNITY_WEIGHTS.relationship * 0.45)
    );
    next.engagement = Math.min(next.engagement, Math.floor(FARMER_OPPORTUNITY_WEIGHTS.engagement * 0.5));
  }

  const highlyEngaged =
    input.engagement.inboundCount30d >= 8 &&
    (input.engagement.richMediaCount30d >= 2 || input.trust.roiEntryCount90d >= 1);
  if (highlyEngaged) {
    next.engagement = Math.max(
      next.engagement,
      Math.min(FARMER_OPPORTUNITY_WEIGHTS.engagement, 16)
    );
    next.trust = Math.max(next.trust, Math.min(FARMER_OPPORTUNITY_WEIGHTS.trust, 11));
  }

  const ref = (input.referral.referralSource ?? '').toLowerCase();
  if (ref && !['whatsapp', 'organic', 'api', 'phone'].includes(ref)) {
    next.relationship = Math.min(
      FARMER_OPPORTUNITY_WEIGHTS.relationship,
      next.relationship + 2
    );
    next.trust = Math.min(FARMER_OPPORTUNITY_WEIGHTS.trust, next.trust + 1);
  }

  if (
    input.trust.recommendationsApplied90d >= 1 &&
    input.advisory.recommendationsCommunicated90d >= 1
  ) {
    next.advisoryCooperation = Math.min(
      FARMER_OPPORTUNITY_WEIGHTS.advisoryCooperation,
      Math.max(next.advisoryCooperation, 7)
    );
  }

  return next;
}

export type RetentionRiskBand = 'healthy' | 'watch' | 'at_risk' | 'churned';

export function computeRetentionRisk(daysSinceLastInbound: number | null): {
  riskBand: RetentionRiskBand;
  retentionScore: number;
  signals: Record<string, unknown>;
} {
  if (daysSinceLastInbound == null) {
    return {
      riskBand: 'watch',
      retentionScore: 40,
      signals: { reason: 'no_inbound_recorded' },
    };
  }
  if (daysSinceLastInbound <= 7) {
    return {
      riskBand: 'healthy',
      retentionScore: 90,
      signals: { daysSinceLastInbound },
    };
  }
  if (daysSinceLastInbound <= 14) {
    return {
      riskBand: 'watch',
      retentionScore: 65,
      signals: { daysSinceLastInbound },
    };
  }
  if (daysSinceLastInbound <= 30) {
    return {
      riskBand: 'at_risk',
      retentionScore: 35,
      signals: { daysSinceLastInbound },
    };
  }
  return {
    riskBand: 'churned',
    retentionScore: 10,
    signals: { daysSinceLastInbound },
  };
}
