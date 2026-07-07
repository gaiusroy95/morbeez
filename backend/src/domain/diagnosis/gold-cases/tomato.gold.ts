import type { DiagnosisGoldCase } from './ginger.gold.js';

export const TOMATO_GOLD_CASES: DiagnosisGoldCase[] = [
  {
    id: 'tomato_early_blight_rings',
    label: 'Early blight with concentric ring spots',
    cropType: 'tomato',
    symptomsText: 'Brown leaf spots with dark concentric rings on lower tomato leaves',
    farmerAnswers: [
      { questionText: 'Do leaf spots have dark concentric rings (target pattern)?', answer: 'yes' },
    ],
    expect: {
      topDiagnosisIncludes: 'Early blight',
      minTopProbability: 0.2,
    },
  },
  {
    id: 'tomato_late_blight_humid',
    label: 'Late blight with water-soaked lesions in humid weather',
    cropType: 'tomato',
    symptomsText: 'Water-soaked greasy spots spreading fast on tomato leaves after rain',
    contextPack: { highHumidityLikely: true, heavyRainLikely: true },
    farmerAnswers: [
      {
        questionText: 'Are lesions water-soaked and spreading fast in humid weather?',
        answer: 'yes',
      },
    ],
    expect: {
      topDiagnosisIncludes: 'Late blight',
      minTopProbability: 0.22,
    },
  },
];
