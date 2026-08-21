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
export declare const DEFAULT_INTRODUCTION_RULE: FarmerIntroductionRule;
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
export declare function evaluateIntroduction(facts: IntroductionFacts, rule?: FarmerIntroductionRule): {
    status: IntroductionStatus;
    reasons: string[];
    cashEligible: boolean;
    cashAmount: number;
    productEligible: boolean;
    productMax: number;
};
//# sourceMappingURL=introduction-eligibility.d.ts.map