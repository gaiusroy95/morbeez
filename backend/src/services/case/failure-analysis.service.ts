export type FailureType =
  | 'ai_failure'
  | 'agronomist_failure'
  | 'farmer_failure'
  | 'product_failure';

export const failureAnalysisService = {
  classify(params: {
    outcomeStatus?: 'improved' | 'same' | 'worse';
    agronomistCorrected?: boolean;
    applicationLogged?: boolean;
    fusedConfidence?: number;
  }): FailureType | null {
    if (params.outcomeStatus === 'worse') {
      if (params.agronomistCorrected) return 'agronomist_failure';
      if (!params.applicationLogged) return 'farmer_failure';
      if ((params.fusedConfidence ?? 0) >= 0.75) return 'product_failure';
      return 'ai_failure';
    }
    return null;
  },
};
