export const gingerSopRiskTagsService = {
    compute(input) {
        const tags = new Set();
        if (input.soilPh != null) {
            if (input.soilPh >= 7.5)
                tags.add('HIGH_PH_RISK');
            if (input.soilPh <= 5.5)
                tags.add('LOW_PH_RISK');
        }
        if (input.soilEc != null && input.soilEc >= 1.8) {
            tags.add('HIGH_EC_RISK');
        }
        if (input.irrigationPh != null) {
            if (input.irrigationPh >= 8)
                tags.add('HIGH_PH_RISK');
            if (input.irrigationPh <= 5.2)
                tags.add('LOW_PH_RISK');
        }
        if (input.irrigationEc != null && input.irrigationEc >= 2.5) {
            tags.add('HIGH_EC_RISK');
        }
        if (input.drainageRisk === 'high' || input.heavyRainLikely) {
            tags.add('WATERLOG_RISK');
        }
        if (input.highHeatLikely)
            tags.add('HEAT_STRESS');
        if (input.weatherRiskScore != null && input.weatherRiskScore >= 55 && !input.heavyRainLikely) {
            tags.add('WATER_STRESS');
        }
        if (input.highHumidityLikely || input.drainageRisk === 'moderate') {
            tags.add('FUNGAL_PRESSURE');
        }
        if (input.lowSoilK || input.lowSoilN) {
            tags.add('NUTRIENT_DEFICIENCY_RISK');
        }
        const blob = `${input.symptomsText ?? ''} ${input.probableIssue ?? ''}`.toLowerCase();
        if (/root|rhizome|nematode|rot|വേര|റൈസോം/.test(blob)) {
            tags.add('ROOT_STRESS_RISK');
        }
        return [...tags];
    },
    weatherStress(input) {
        const heat = input.highHeatLikely ? 78 : input.weatherRiskScore != null && input.weatherRiskScore > 40 ? 45 : 20;
        const water = input.heavyRainLikely || input.drainageRisk === 'high'
            ? 82
            : input.weatherRiskScore != null && input.weatherRiskScore > 50
                ? 55
                : 25;
        const disease = input.highHumidityLikely || input.drainageRisk !== 'low'
            ? Math.min(90, 40 + (input.weatherRiskScore ?? 30) * 0.5)
            : 30;
        return {
            heatStress: Math.round(heat),
            waterStress: Math.round(water),
            diseasePressure: Math.round(disease),
        };
    },
};
//# sourceMappingURL=ginger-sop-risk-tags.service.js.map