export const COCONUT_GOLD_CASES = [
    {
        id: 'coconut_bud_rot_rain',
        label: 'Bud rot after heavy rain in crown',
        cropType: 'coconut',
        symptomsText: 'Spear leaf rotting with foul smell in crown after continuous rain',
        contextPack: { heavyRainLikely: true, highHumidityLikely: true },
        farmerAnswers: [
            { questionText: 'Is the spear leaf rotting with foul smell in the crown?', answer: 'yes' },
        ],
        expect: {
            topDiagnosisIncludes: 'Bud rot',
            minTopProbability: 0.22,
        },
    },
    {
        id: 'coconut_beetle_damage',
        label: 'Rhinoceros beetle bore holes in crown',
        cropType: 'coconut',
        symptomsText: 'Chewed fibres and bore holes visible in coconut crown',
        farmerAnswers: [
            {
                questionText: 'Are there bore holes or chewed fibres in the crown or trunk?',
                answer: 'yes',
            },
        ],
        visionLabel: 'Rhinoceros beetle damage',
        visionConfidence: 0.75,
        expect: {
            topDiagnosisIncludes: 'beetle',
            minTopProbability: 0.2,
        },
    },
];
//# sourceMappingURL=coconut.gold.js.map