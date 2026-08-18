export type IntroductionStatus = 'pending' | 'review' | 'eligible' | 'rejected' | 'fraud_hold';

export type FarmerIntroductionRule = {
  minAcreage: number;
  cashRewardInr: number;
  productRewardInr: number;
  requireNewFarmer: boolean;
  requireFarmerVerified: boolean;
  requireFieldVerified: boolean;
  requireEvidence: boolean;
  requireAgronomistEngagement: boolean;
  existingFarmerHours: number;
};

export const DEFAULT_INTRODUCTION_RULE: FarmerIntroductionRule = {
  minAcreage: 2,
  cashRewardInr: 100,
  productRewardInr: 400,
  requireNewFarmer: true,
  requireFarmerVerified: true,
  requireFieldVerified: true,
  requireEvidence: true,
  requireAgronomistEngagement: true,
  existingFarmerHours: 24,
};

export type IntroductionFacts = {
  newFarmer: boolean;
  duplicateMobile: boolean;
  duplicatePartnerClaim: boolean;
  acreage: number;
  farmerVerified: boolean;
  fieldVerified: boolean;
  evidenceComplete: boolean;
  agronomistEngaged: boolean;
  fraud: boolean;
};

export function evaluateIntroduction(
  facts: IntroductionFacts,
  rule = DEFAULT_INTRODUCTION_RULE
): {
  status: IntroductionStatus;
  reasons: string[];
  cashEligible: boolean;
  cashAmount: number;
  productEligible: boolean;
  productMax: number;
} {
  const reasons: string[] = [];
  if (facts.fraud) {
    return {
      status: 'fraud_hold',
      reasons: ['fraud'],
      cashEligible: false,
      cashAmount: 0,
      productEligible: false,
      productMax: 0,
    };
  }
  if (facts.duplicateMobile) {
    return {
      status: 'rejected',
      reasons: ['duplicate_mobile'],
      cashEligible: false,
      cashAmount: 0,
      productEligible: false,
      productMax: 0,
    };
  }
  if (facts.duplicatePartnerClaim) {
    return {
      status: 'rejected',
      reasons: ['duplicate_partner_claim'],
      cashEligible: false,
      cashAmount: 0,
      productEligible: false,
      productMax: 0,
    };
  }
  if (rule.requireNewFarmer && !facts.newFarmer) {
    return {
      status: 'review',
      reasons: ['existing_farmer'],
      cashEligible: false,
      cashAmount: 0,
      productEligible: false,
      productMax: 0,
    };
  }

  if (facts.acreage + 1e-9 < rule.minAcreage) reasons.push('min_acreage');
  if (rule.requireFarmerVerified && !facts.farmerVerified) reasons.push('farmer_not_verified');
  if (rule.requireFieldVerified && !facts.fieldVerified) reasons.push('field_not_verified');
  if (rule.requireEvidence && !facts.evidenceComplete) reasons.push('evidence_incomplete');
  if (rule.requireAgronomistEngagement && !facts.agronomistEngaged) reasons.push('agronomist_not_engaged');

  if (reasons.length) {
    return {
      status: 'pending',
      reasons,
      cashEligible: false,
      cashAmount: 0,
      productEligible: false,
      productMax: 0,
    };
  }

  return {
    status: 'eligible',
    reasons: [],
    cashEligible: true,
    cashAmount: Math.round(Math.max(0, rule.cashRewardInr) * 100) / 100,
    productEligible: true,
    productMax: Math.round(Math.max(0, rule.productRewardInr) * 100) / 100,
  };
}
