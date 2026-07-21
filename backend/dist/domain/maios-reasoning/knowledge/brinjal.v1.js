/** Brinjal (eggplant) scientific knowledge v1 — expert-governed LR matrix. */
export const BRINJAL_KNOWLEDGE_V1 = {
    cropType: 'brinjal',
    version: '1.0',
    diseaseLabels: [
        'Bacterial wilt (Ralstonia)',
        'Fruit and shoot borer',
        'Leaf spot (Alternaria)',
        'Nutrient deficiency',
        'Unknown',
    ],
    defaultPriorWeight: {
        'Bacterial wilt (Ralstonia)': 0.2,
        'Fruit and shoot borer': 0.18,
        'Leaf spot (Alternaria)': 0.16,
        'Nutrient deficiency': 0.16,
        Unknown: 0.3,
    },
    likelihoodRatios: [
        { evidenceKey: 'weather:heavy_rain', diseaseLabel: 'Bacterial wilt (Ralstonia)', lr: 2.3 },
        { evidenceKey: 'symptom:wilt_collapse', diseaseLabel: 'Bacterial wilt (Ralstonia)', lr: 3.2 },
        { evidenceKey: 'symptom:vascular_brown', diseaseLabel: 'Bacterial wilt (Ralstonia)', lr: 3.0 },
        { evidenceKey: 'symptom:borer_hole', diseaseLabel: 'Fruit and shoot borer', lr: 3.4 },
        { evidenceKey: 'vision:borer', diseaseLabel: 'Fruit and shoot borer', lr: 2.8 },
        { evidenceKey: 'symptom:concentric_rings', diseaseLabel: 'Leaf spot (Alternaria)', lr: 2.9 },
        { evidenceKey: 'vision:blast', diseaseLabel: 'Leaf spot (Alternaria)', lr: 2.4 },
        { evidenceKey: 'symptom:yellowing', diseaseLabel: 'Nutrient deficiency', lr: 2.3 },
        { evidenceKey: 'soil:low_n', diseaseLabel: 'Nutrient deficiency', lr: 2.2 },
        { evidenceKey: 'farmer:wilt_yes', diseaseLabel: 'Bacterial wilt (Ralstonia)', lr: 2.7 },
        { evidenceKey: 'farmer:borer_yes', diseaseLabel: 'Fruit and shoot borer', lr: 2.8 },
    ],
    questions: [
        {
            id: 'whole_plant_wilt',
            text: 'Is the whole plant wilting suddenly even when soil is moist?',
            answerType: 'yes_no',
            evidenceKeyIfYes: 'symptom:wilt_collapse',
        },
        {
            id: 'shoot_borer_holes',
            text: 'Are there bore holes or drooping shoots with wilted tips?',
            answerType: 'yes_no',
            evidenceKeyIfYes: 'symptom:borer_hole',
        },
        {
            id: 'leaf_spot_rings',
            text: 'Do leaf spots have concentric dark rings?',
            answerType: 'yes_no',
            evidenceKeyIfYes: 'symptom:concentric_rings',
        },
    ],
    managementRules: [
        {
            diseaseLabel: 'Bacterial wilt (Ralstonia)',
            objectives: ['Prevent spread in nursery', 'Rogue infected plants early'],
            ipm: ['Use disease-free seedlings', 'Disinfect tools between plants'],
            cultural: ['Avoid waterlogging', 'Crop rotation with non-solanaceous crops'],
            nutrition: ['Balanced nutrition — avoid excess N'],
            biological: ['Trichoderma root dip at transplant'],
            chemical: [{ activeIngredientClass: 'Soil sanitizer', notes: 'Prevention only; no cure once established' }],
            monitoring: ['D3 adjacent plant check'],
        },
        {
            diseaseLabel: 'Fruit and shoot borer',
            objectives: ['Protect shoots and young fruit', 'Reduce egg laying'],
            ipm: ['Remove and destroy wilted shoots with larvae'],
            cultural: ['Pheromone traps at field border', 'Harvest mature fruit promptly'],
            nutrition: ['Maintain plant vigour with balanced K'],
            biological: ['Release Trichogramma when trap catches rise'],
            chemical: [{ activeIngredientClass: 'Spinosad', notes: 'Target young larvae; PHI check' }],
            monitoring: ['D7 trap and shoot inspection'],
        },
    ],
    safetyRules: [
        {
            id: 'no_spray_heavy_rain',
            check: 'weather',
            condition: 'heavy_rain_forecast',
            rejectReason: 'Do not spray foliar products within 24h of heavy rain forecast',
        },
    ],
};
//# sourceMappingURL=brinjal.v1.js.map