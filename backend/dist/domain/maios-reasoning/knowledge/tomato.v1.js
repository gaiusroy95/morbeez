/** Tomato scientific knowledge v1 — expert-governed LR matrix. */
export const TOMATO_KNOWLEDGE_V1 = {
    cropType: 'tomato',
    version: '1.0',
    diseaseLabels: [
        'Early blight (Alternaria)',
        'Late blight (Phytophthora)',
        'Bacterial leaf spot',
        'Nutrient deficiency',
        'Unknown',
    ],
    defaultPriorWeight: {
        'Early blight (Alternaria)': 0.2,
        'Late blight (Phytophthora)': 0.18,
        'Bacterial leaf spot': 0.15,
        'Nutrient deficiency': 0.15,
        Unknown: 0.32,
    },
    likelihoodRatios: [
        { evidenceKey: 'weather:high_humidity', diseaseLabel: 'Late blight (Phytophthora)', lr: 2.6 },
        { evidenceKey: 'weather:heavy_rain', diseaseLabel: 'Late blight (Phytophthora)', lr: 2.4 },
        { evidenceKey: 'symptom:concentric_rings', diseaseLabel: 'Early blight (Alternaria)', lr: 3.2 },
        { evidenceKey: 'symptom:water_soaked', diseaseLabel: 'Late blight (Phytophthora)', lr: 3.0 },
        { evidenceKey: 'symptom:yellowing', diseaseLabel: 'Nutrient deficiency', lr: 2.2 },
        { evidenceKey: 'vision:blast', diseaseLabel: 'Early blight (Alternaria)', lr: 2.3 },
        { evidenceKey: 'vision:rot', diseaseLabel: 'Late blight (Phytophthora)', lr: 2.5 },
        { evidenceKey: 'farmer:rings_yes', diseaseLabel: 'Early blight (Alternaria)', lr: 2.7 },
        { evidenceKey: 'soil:low_n', diseaseLabel: 'Nutrient deficiency', lr: 2.3 },
    ],
    questions: [
        {
            id: 'concentric_rings',
            text: 'Do leaf spots have dark concentric rings (target pattern)?',
            answerType: 'yes_no',
            evidenceKeyIfYes: 'symptom:concentric_rings',
        },
        {
            id: 'water_soaked_lesions',
            text: 'Are lesions water-soaked and spreading fast in humid weather?',
            answerType: 'yes_no',
            evidenceKeyIfYes: 'symptom:water_soaked',
        },
    ],
    managementRules: [
        {
            diseaseLabel: 'Early blight (Alternaria)',
            objectives: ['Slow lesion spread', 'Protect lower canopy'],
            ipm: ['Remove infected lower leaves', 'Mulch soil surface'],
            cultural: ['Wider spacing for airflow', 'Avoid overhead irrigation'],
            nutrition: ['Balanced K to strengthen leaves'],
            biological: ['Trichoderma soil application between rows'],
            chemical: [
                { activeIngredientClass: 'Chlorothalonil (multi-site)', notes: 'Preventive; rotate MOA' },
                { activeIngredientClass: 'Strobilurin (QoI)', notes: 'Early stage only' },
            ],
            monitoring: ['D7 lower leaf check'],
        },
    ],
    safetyRules: [
        {
            id: 'no_spray_heavy_rain',
            check: 'weather',
            condition: 'heavy_rain_forecast',
            rejectReason: 'Do not spray foliar fungicide within 24h of heavy rain',
        },
    ],
};
//# sourceMappingURL=tomato.v1.js.map