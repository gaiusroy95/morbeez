import type { CropKnowledgePackage } from '../types.js';

/**
 * Generic fallback knowledge for non-pilot crops.
 * Conservative priors + symptom-only LRs — expert crop packs override this.
 */
export const DEFAULT_KNOWLEDGE_V1: CropKnowledgePackage = {
  cropType: '_default',
  version: '1.0',
  diseaseLabels: [
    'Fungal leaf disease',
    'Bacterial leaf disease',
    'Nutrient deficiency',
    'Pest damage',
    'Unknown',
  ],
  defaultPriorWeight: {
    'Fungal leaf disease': 0.2,
    'Bacterial leaf disease': 0.15,
    'Nutrient deficiency': 0.18,
    'Pest damage': 0.15,
    Unknown: 0.32,
  },
  likelihoodRatios: [
    { evidenceKey: 'weather:high_humidity', diseaseLabel: 'Fungal leaf disease', lr: 2.2 },
    { evidenceKey: 'weather:heavy_rain', diseaseLabel: 'Bacterial leaf disease', lr: 2.0 },
    { evidenceKey: 'symptom:yellowing', diseaseLabel: 'Nutrient deficiency', lr: 2.3 },
    { evidenceKey: 'symptom:silver_streak', diseaseLabel: 'Pest damage', lr: 2.4 },
    { evidenceKey: 'symptom:spindle_lesion', diseaseLabel: 'Fungal leaf disease', lr: 2.1 },
    { evidenceKey: 'symptom:soft_rot', diseaseLabel: 'Bacterial leaf disease', lr: 2.2 },
    { evidenceKey: 'vision:blast', diseaseLabel: 'Fungal leaf disease', lr: 2.0 },
    { evidenceKey: 'vision:rot', diseaseLabel: 'Bacterial leaf disease', lr: 2.0 },
    { evidenceKey: 'vision:thrips', diseaseLabel: 'Pest damage', lr: 2.1 },
    { evidenceKey: 'soil:low_n', diseaseLabel: 'Nutrient deficiency', lr: 2.2 },
  ],
  questions: [
    {
      id: 'symptoms_after_rain',
      text: 'Did symptoms worsen after heavy rain in the last 7 days?',
      answerType: 'yes_no',
      evidenceKeyIfYes: 'farmer:rain_worse_yes',
    },
    {
      id: 'yellowing_leaves',
      text: 'Are older leaves turning yellow uniformly?',
      answerType: 'yes_no',
      evidenceKeyIfYes: 'symptom:yellowing',
    },
  ],
  managementRules: [
    {
      diseaseLabel: 'Fungal leaf disease',
      objectives: ['Stop spread', 'Protect new growth'],
      ipm: ['Scout weekly', 'Remove severely affected tissue if <10% canopy'],
      cultural: ['Improve airflow', 'Avoid overhead irrigation in humid periods'],
      nutrition: ['Balanced NPK per soil test'],
      biological: ['Consider biocontrol when humidity high'],
      chemical: [{ activeIngredientClass: 'Triazole (DMI)', notes: 'Early stage only; rotate MOA' }],
      monitoring: ['Re-check in 7 days'],
    },
  ],
  safetyRules: [
    {
      id: 'no_spray_heavy_rain',
      check: 'weather' as const,
      condition: 'heavy_rain_forecast',
      rejectReason: 'Do not spray foliar products within 24h of heavy rain forecast',
    },
  ],
};
