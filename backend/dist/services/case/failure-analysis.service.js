export const failureAnalysisService = {
    classify(params) {
        if (params.outcomeStatus === 'worse') {
            if (params.agronomistCorrected)
                return 'agronomist_failure';
            if (!params.applicationLogged)
                return 'farmer_failure';
            if ((params.fusedConfidence ?? 0) >= 0.75)
                return 'product_failure';
            return 'ai_failure';
        }
        return null;
    },
};
//# sourceMappingURL=failure-analysis.service.js.map