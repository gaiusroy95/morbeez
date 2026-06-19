export const economicGateService = {
  assess(params: {
    treatmentCostInr?: number;
    expectedBenefitInr?: number;
    mandiPricePerKg?: number;
  }): { roi: number | null; proceed: boolean; reason: string } {
    const cost = params.treatmentCostInr ?? 0;
    const benefit = params.expectedBenefitInr ?? 0;
    if (cost <= 0) return { roi: null, proceed: true, reason: 'No cost estimate' };
    const roi = benefit > 0 ? (benefit - cost) / cost : -1;
    const proceed = roi >= 0 || benefit === 0;
    return {
      roi,
      proceed,
      reason: proceed ? 'Positive or unknown ROI' : 'Negative ROI — review recommended',
    };
  },
};
