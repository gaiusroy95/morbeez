import type { FarmerScoreComponents, ScoreFactor } from './opportunity-intelligence.types.js';
export declare const HIGH_VALUE_CROPS: Set<string>;
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
export declare function scoreEngagement(signals: FarmerEngagementSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreTrust(signals: FarmerTrustSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreAcreSize(totalAcreage: number | null): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreAcrePotential(profile: FarmerProfileSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreRelationship(signals: FarmerRelationshipSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreAdvisoryCooperation(signals: FarmerAdvisorySignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreCropValue(primaryCrop: string | null): {
    score: number;
    factors: ScoreFactor[];
};
export declare function scoreReferralInfluence(signals: FarmerReferralSignals): {
    score: number;
    factors: ScoreFactor[];
};
export declare function computeFarmerScoreComponents(input: {
    engagement: FarmerEngagementSignals;
    trust: FarmerTrustSignals;
    profile: FarmerProfileSignals;
    relationship: FarmerRelationshipSignals;
    advisory: FarmerAdvisorySignals;
    referral: FarmerReferralSignals;
}): {
    components: FarmerScoreComponents;
    factors: ScoreFactor[];
};
/** Aligns scores with real archetypes: fast buyer / quiet farmer, referral trust, etc. */
export declare function applyFarmerBehavioralModifiers(components: FarmerScoreComponents, input: {
    engagement: FarmerEngagementSignals;
    trust: FarmerTrustSignals;
    relationship: FarmerRelationshipSignals;
    referral: FarmerReferralSignals;
    advisory: FarmerAdvisorySignals;
}): FarmerScoreComponents;
export type RetentionRiskBand = 'healthy' | 'watch' | 'at_risk' | 'churned';
export declare function computeRetentionRisk(daysSinceLastInbound: number | null): {
    riskBand: RetentionRiskBand;
    retentionScore: number;
    signals: Record<string, unknown>;
};
//# sourceMappingURL=farmer-opportunity-scoring.util.d.ts.map