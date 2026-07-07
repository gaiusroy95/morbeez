/** Expert-governed gold cases for v17 regression — LR matrix must pass these before release. */
export type DiagnosisGoldCase = {
  id: string;
  label: string;
  cropType: 'ginger' | 'banana' | 'tomato' | 'coconut' | 'brinjal';
  symptomsText: string;
  contextPack?: {
    heavyRainLikely?: boolean;
    highHumidityLikely?: boolean;
    highHeatLikely?: boolean;
    soilPh?: number;
  };
  farmerAnswers?: Array<{ questionText: string; answer: string }>;
  visionLabel?: string;
  visionConfidence?: number;
  photoSlots?: string[];
  expect: {
    topDiagnosisIncludes: string;
    minTopProbability: number;
    minReliableEvidence?: number;
  };
};

export const GINGER_GOLD_CASES: DiagnosisGoldCase[] = [
  {
    id: 'ginger_blast_rain_spindle',
    label: 'Classic Pyricularia blast after rain with spindle lesions',
    cropType: 'ginger',
    symptomsText: 'Spindle shaped brown lesions on young leaves after heavy rain',
    contextPack: { heavyRainLikely: true, highHumidityLikely: true },
    farmerAnswers: [
      { questionText: 'Are black dots visible inside the lesions?', answer: 'yes' },
      { questionText: 'Did symptoms worsen after heavy rain in the last 7 days?', answer: 'yes' },
    ],
    visionLabel: 'Pyricularia leaf blast',
    visionConfidence: 0.88,
    photoSlots: ['new_leaf_close'],
    expect: {
      topDiagnosisIncludes: 'blast',
      minTopProbability: 0.35,
      minReliableEvidence: 3,
    },
  },
  {
    id: 'ginger_rhizome_rot_waterlogged',
    label: 'Rhizome rot with waterlogging and soft rhizome',
    cropType: 'ginger',
    symptomsText: 'Plants wilting in low beds after continuous rain, rhizome smells bad',
    contextPack: { heavyRainLikely: true, highHumidityLikely: true },
    farmerAnswers: [
      { questionText: 'Is the rhizome soft or foul-smelling when cut?', answer: 'yes' },
    ],
    photoSlots: ['rhizome_cut'],
    expect: {
      topDiagnosisIncludes: 'Rhizome rot',
      minTopProbability: 0.28,
      minReliableEvidence: 2,
    },
  },
  {
    id: 'ginger_thrips_silver',
    label: 'Thrips with silver streaks on leaves',
    cropType: 'ginger',
    symptomsText: 'Silver streaks and curling on new flush leaves',
    farmerAnswers: [
      { questionText: 'Do you see silver streaks or scraping marks on leaves?', answer: 'yes' },
    ],
    visionLabel: 'Thrips',
    visionConfidence: 0.75,
    photoSlots: ['leaf_underside'],
    expect: {
      topDiagnosisIncludes: 'Thrips',
      minTopProbability: 0.25,
    },
  },
  {
    id: 'ginger_nutrient_yellowing',
    label: 'Nutrient deficiency with uniform yellowing',
    cropType: 'ginger',
    symptomsText: 'Uniform yellowing and chlorosis of older leaves, no distinct lesions',
    contextPack: { highHeatLikely: true, soilPh: 5.3 },
    expect: {
      topDiagnosisIncludes: 'Nutrient',
      minTopProbability: 0.18,
    },
  },
];
