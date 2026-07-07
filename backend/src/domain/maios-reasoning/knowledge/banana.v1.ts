import type { CropKnowledgePackage } from '../types.js';

const BANANA_SAFETY_RULES = [
  {
    id: 'no_foliar_heavy_rain',
    check: 'weather' as const,
    condition: 'heavy_rain_forecast',
    rejectReason: 'Do not spray foliar products within 24h of heavy rain forecast',
  },
  {
    id: 'no_fungicide_peak_heat',
    check: 'weather' as const,
    condition: 'high_heat',
    rejectReason: 'Avoid foliar fungicide during peak heat stress',
  },
];

const BANANA_MANAGEMENT: CropKnowledgePackage['managementRules'] = [
  {
    diseaseLabel: 'Sigatoka leaf spot',
    objectives: ['Slow lesion spread', 'Protect functional leaf area', 'Maintain bunch filling'],
    ipm: ['Remove severely affected old leaves if <15% canopy', 'Scout weekly on youngest open leaf'],
    cultural: ['Improve air flow between mats', 'Avoid overhead irrigation in humid weather'],
    nutrition: ['Balanced K to support leaf health post-recovery'],
    biological: ['Consider biocontrol spray on new flush when humidity high'],
    chemical: [
      { activeIngredientClass: 'Triazole (DMI)', notes: 'Curative at early streak stage; rotate MOA' },
      { activeIngredientClass: 'Strobilurin (QoI)', notes: 'Preventive; PHI check before harvest' },
    ],
    monitoring: ['D7 youngest leaf check', 'D14 canopy photo'],
  },
  {
    diseaseLabel: 'Panama wilt / Fusarium',
    objectives: ['Prevent spread to adjacent mats', 'Improve drainage', 'Plan replacement if advanced'],
    ipm: ['Inspect pseudostem split for vascular browning', 'Flag infected mats — do not share suckers'],
    cultural: ['Rogue infected plants', 'Disinfect tools between mats', 'Avoid planting in known wilt history blocks'],
    nutrition: ['Calcium + silicon support where soil test confirms need'],
    biological: ['Trichoderma drench on healthy adjacent mats only'],
    chemical: [
      { activeIngredientClass: 'Soil sanitizer', notes: 'Limited efficacy once established; prevention focus' },
    ],
    monitoring: ['D3 adjacent mat check', 'D21 pseudostem re-inspection'],
  },
];

/** Banana scientific knowledge v1 — expert-governed LR matrix (not auto-trained). */
export const BANANA_KNOWLEDGE_V1: CropKnowledgePackage = {
  cropType: 'banana',
  version: '1.0',
  diseaseLabels: [
    'Sigatoka leaf spot',
    'Panama wilt / Fusarium',
    'Banana weevil borer',
    'Nutrient deficiency',
    'Unknown',
  ],
  defaultPriorWeight: {
    'Sigatoka leaf spot': 0.22,
    'Panama wilt / Fusarium': 0.18,
    'Banana weevil borer': 0.14,
    'Nutrient deficiency': 0.16,
    Unknown: 0.25,
  },
  likelihoodRatios: [
    { evidenceKey: 'weather:high_humidity', diseaseLabel: 'Sigatoka leaf spot', lr: 2.5 },
    { evidenceKey: 'weather:heavy_rain', diseaseLabel: 'Panama wilt / Fusarium', lr: 2.2 },
    { evidenceKey: 'symptom:yellow_streak', diseaseLabel: 'Sigatoka leaf spot', lr: 3.1 },
    { evidenceKey: 'symptom:parallel_streak', diseaseLabel: 'Sigatoka leaf spot', lr: 2.8 },
    { evidenceKey: 'symptom:wilt_collapse', diseaseLabel: 'Panama wilt / Fusarium', lr: 3.4 },
    { evidenceKey: 'symptom:vascular_brown', diseaseLabel: 'Panama wilt / Fusarium', lr: 3.2 },
    { evidenceKey: 'symptom:borer_hole', diseaseLabel: 'Banana weevil borer', lr: 3.5 },
    { evidenceKey: 'symptom:yellowing', diseaseLabel: 'Nutrient deficiency', lr: 2.3 },
    { evidenceKey: 'vision:sigatoka', diseaseLabel: 'Sigatoka leaf spot', lr: 2.7 },
    { evidenceKey: 'vision:wilt', diseaseLabel: 'Panama wilt / Fusarium', lr: 2.6 },
    { evidenceKey: 'vision:borer', diseaseLabel: 'Banana weevil borer', lr: 2.8 },
    { evidenceKey: 'farmer:streaks_yes', diseaseLabel: 'Sigatoka leaf spot', lr: 2.5 },
    { evidenceKey: 'farmer:wilt_yes', diseaseLabel: 'Panama wilt / Fusarium', lr: 2.8 },
    { evidenceKey: 'soil:low_k', diseaseLabel: 'Nutrient deficiency', lr: 2.1 },
    { evidenceKey: 'soil:low_n', diseaseLabel: 'Nutrient deficiency', lr: 2.3 },
  ],
  questions: [
    {
      id: 'yellow_streaks_leaf',
      text: 'Do you see yellow streaks running parallel to the leaf veins?',
      answerType: 'yes_no',
      evidenceKeyIfYes: 'symptom:yellow_streak',
    },
    {
      id: 'pseudostem_wilt',
      text: 'Is the pseudostem splitting or wilting from the base?',
      answerType: 'yes_no',
      evidenceKeyIfYes: 'symptom:wilt_collapse',
    },
    {
      id: 'borer_holes',
      text: 'Are there bore holes or sawdust at the pseudostem base?',
      answerType: 'yes_no',
      evidenceKeyIfYes: 'symptom:borer_hole',
    },
  ],
  managementRules: BANANA_MANAGEMENT,
  safetyRules: BANANA_SAFETY_RULES,
};
