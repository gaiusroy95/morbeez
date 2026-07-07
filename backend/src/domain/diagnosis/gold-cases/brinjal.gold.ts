import type { DiagnosisGoldCase } from './ginger.gold.js';

export const BRINJAL_GOLD_CASES: DiagnosisGoldCase[] = [
  {
    id: 'brinjal_bacterial_wilt',
    label: 'Bacterial wilt with sudden whole-plant collapse',
    cropType: 'brinjal',
    symptomsText: 'Brinjal plants wilting suddenly in moist soil, vascular browning when stem cut',
    contextPack: { heavyRainLikely: true },
    farmerAnswers: [
      { questionText: 'Is the whole plant wilting suddenly even when soil is moist?', answer: 'yes' },
    ],
    expect: {
      topDiagnosisIncludes: 'Bacterial wilt',
      minTopProbability: 0.22,
    },
  },
  {
    id: 'brinjal_shoot_borer',
    label: 'Fruit and shoot borer with bore holes in shoots',
    cropType: 'brinjal',
    symptomsText: 'Drooping brinjal shoots with bore holes and frass near growing tips',
    farmerAnswers: [
      { questionText: 'Are there bore holes or drooping shoots with wilted tips?', answer: 'yes' },
    ],
    visionLabel: 'Leucinodes orbonalis fruit borer',
    visionConfidence: 0.82,
    expect: {
      topDiagnosisIncludes: 'borer',
      minTopProbability: 0.2,
    },
  },
];
