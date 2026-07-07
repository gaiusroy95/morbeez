import type { CropKnowledgePackage } from '../types.js';

/** Coconut scientific knowledge v1 — expert-governed LR matrix. */
export const COCONUT_KNOWLEDGE_V1: CropKnowledgePackage = {
  cropType: 'coconut',
  version: '1.0',
  diseaseLabels: [
    'Bud rot (Phytophthora)',
    'Rhinoceros beetle damage',
    'Nutrient deficiency',
    'Root wilt',
    'Unknown',
  ],
  defaultPriorWeight: {
    'Bud rot (Phytophthora)': 0.2,
    'Rhinoceros beetle damage': 0.16,
    'Nutrient deficiency': 0.16,
    'Root wilt': 0.14,
    Unknown: 0.34,
  },
  likelihoodRatios: [
    { evidenceKey: 'weather:high_humidity', diseaseLabel: 'Bud rot (Phytophthora)', lr: 2.5 },
    { evidenceKey: 'weather:heavy_rain', diseaseLabel: 'Bud rot (Phytophthora)', lr: 2.6 },
    { evidenceKey: 'symptom:bud_rot', diseaseLabel: 'Bud rot (Phytophthora)', lr: 3.4 },
    { evidenceKey: 'symptom:beetle_damage', diseaseLabel: 'Rhinoceros beetle damage', lr: 3.2 },
    { evidenceKey: 'symptom:yellowing', diseaseLabel: 'Nutrient deficiency', lr: 2.2 },
    { evidenceKey: 'symptom:wilt_collapse', diseaseLabel: 'Root wilt', lr: 3.0 },
    { evidenceKey: 'vision:rot', diseaseLabel: 'Bud rot (Phytophthora)', lr: 2.6 },
    { evidenceKey: 'farmer:bud_rot_yes', diseaseLabel: 'Bud rot (Phytophthora)', lr: 2.8 },
    { evidenceKey: 'symptom:beetle_damage', diseaseLabel: 'Rhinoceros beetle damage', lr: 3.2 },
    { evidenceKey: 'vision:borer', diseaseLabel: 'Rhinoceros beetle damage', lr: 2.5 },
    { evidenceKey: 'soil:low_n', diseaseLabel: 'Nutrient deficiency', lr: 2.2 },
  ],
  questions: [
    {
      id: 'bud_rot_smell',
      text: 'Is the spear leaf rotting with foul smell in the crown?',
      answerType: 'yes_no',
      evidenceKeyIfYes: 'symptom:bud_rot',
    },
    {
      id: 'beetle_borers',
      text: 'Are there bore holes or chewed fibres in the crown or trunk?',
      answerType: 'yes_no',
      evidenceKeyIfYes: 'symptom:beetle_damage',
    },
  ],
  managementRules: [
    {
      diseaseLabel: 'Bud rot (Phytophthora)',
      objectives: ['Save palm if caught early', 'Prevent spread in nursery'],
      ipm: ['Remove rotted spear tissue if <25% crown affected'],
      cultural: ['Improve drainage', 'Avoid injury to crown during work'],
      nutrition: ['Boron + potassium after recovery phase'],
      biological: ['Trichoderma crown drench on adjacent palms'],
      chemical: [
        { activeIngredientClass: 'Phosphonate', notes: 'Crown drench only; expert supervision' },
      ],
      monitoring: ['D3 crown inspection', 'D14 new spear emergence'],
    },
  ],
  safetyRules: [
    {
      id: 'no_crown_chemical_heat',
      check: 'weather' as const,
      condition: 'high_heat',
      rejectReason: 'Avoid crown drenches during peak heat stress',
    },
  ],
};
