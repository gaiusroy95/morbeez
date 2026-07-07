import type { DiagnosisGoldCase } from './ginger.gold.js';

export const BANANA_GOLD_CASES: DiagnosisGoldCase[] = [
  {
    id: 'banana_sigatoka_humid',
    label: 'Sigatoka with yellow streaks in humid weather',
    cropType: 'banana',
    symptomsText: 'Yellow streaks parallel to veins on older banana leaves in humid plot',
    contextPack: { highHumidityLikely: true },
    farmerAnswers: [
      { questionText: 'Do you see yellow streaks running parallel to the leaf veins?', answer: 'yes' },
    ],
    visionLabel: 'Sigatoka leaf spot',
    visionConfidence: 0.82,
    expect: {
      topDiagnosisIncludes: 'Sigatoka',
      minTopProbability: 0.22,
    },
  },
  {
    id: 'banana_panama_wilt',
    label: 'Panama wilt with pseudostem collapse after rain',
    cropType: 'banana',
    symptomsText: 'Pseudostem splitting and wilt after heavy rain',
    contextPack: { heavyRainLikely: true, highHumidityLikely: true },
    farmerAnswers: [
      { questionText: 'Is the pseudostem splitting or wilting from the base?', answer: 'yes' },
    ],
    expect: {
      topDiagnosisIncludes: 'Panama',
      minTopProbability: 0.2,
    },
  },
  {
    id: 'banana_weevil_borer',
    label: 'Banana weevil borer at stem base',
    cropType: 'banana',
    symptomsText: 'Sawdust frass and bore holes at the stem base, plant leaning',
    farmerAnswers: [
      { questionText: 'Are there bore holes or sawdust at the stem base?', answer: 'yes' },
    ],
    visionLabel: 'Banana weevil borer',
    visionConfidence: 0.78,
    expect: {
      topDiagnosisIncludes: 'weevil',
      minTopProbability: 0.2,
    },
  },
  {
    id: 'banana_nutrient_yellowing',
    label: 'Nutrient deficiency with uniform yellowing',
    cropType: 'banana',
    symptomsText: 'Uniform yellowing and chlorosis of older leaves, no streaks on veins',
    contextPack: { highHeatLikely: true, soilPh: 5.4 },
    farmerAnswers: [
      { questionText: 'Are older leaves turning yellow uniformly?', answer: 'yes' },
    ],
    expect: {
      topDiagnosisIncludes: 'Nutrient',
      minTopProbability: 0.15,
    },
  },
];
