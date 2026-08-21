export const DEFAULT_INTRODUCTION_RULE = {
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
export function evaluateIntroduction(facts, rule = DEFAULT_INTRODUCTION_RULE) {
    const reasons = [];
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
    if (facts.acreage + 1e-9 < rule.minAcreage)
        reasons.push('min_acreage');
    if (rule.requireFarmerVerified && !facts.farmerVerified)
        reasons.push('farmer_not_verified');
    if (rule.requireFieldVerified && !facts.fieldVerified)
        reasons.push('field_not_verified');
    if (rule.requireEvidence && !facts.evidenceComplete)
        reasons.push('evidence_incomplete');
    if (rule.requireAgronomistEngagement && !facts.agronomistEngaged)
        reasons.push('agronomist_not_engaged');
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
//# sourceMappingURL=introduction-eligibility.js.map