import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifiedAdvisoryLearningService,
} from '../src/services/core/verified-advisory-learning.service.js';
import { buildSymptomKey } from '../src/services/ai/ai-reuse.service.js';

describe('verified advisory learning', () => {
  it('builds stable strict and loose symptom keys from farmer question text', () => {
    const q = 'Yellow spots on ginger leaves spreading fast';
    const keys = verifiedAdvisoryLearningService.uniqueSymptomKeys([q, q]);
    assert.equal(keys.length, 2);
    assert.ok(keys.includes(buildSymptomKey(q)));
  });

  it('indexes multiple keys when question and diagnosis differ', () => {
    const keys = verifiedAdvisoryLearningService.uniqueSymptomKeys([
      'fertilizer for ginger current stage',
      'nutrient deficiency',
    ]);
    assert.equal(keys.length, 4);
    assert.notEqual(keys[0], keys[1]);
  });

  it('formats Malayalam summary when provided', () => {
    const msg = verifiedAdvisoryLearningService.formatFarmerMessage(
      {
        probableIssue: 'Thrips',
        confidence: 0.9,
        uncertain: false,
        nutrientDeficiency: [],
        stressAnalysis: [],
        treatments: [],
        dosageGuidance: [],
        precautions: [],
        escalationRecommended: false,
        farmerSummaryEn: 'English text',
        farmerSummaryMl: 'മലയാളം ടെക്സ്റ്റ്',
        recommendedProductTags: [],
      },
      'ml'
    );
    assert.equal(msg, 'മലയാളം ടെക്സ്റ്റ്');
  });
});
