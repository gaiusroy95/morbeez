import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectNutrientIds,
  expandSeparateVisitIssues,
  shouldSplitNutrientIssue,
} from '../src/services/core/visit-issue-split.util.js';

describe('visit-issue-split', () => {
  it('detects nitrogen and potassium in combined label', () => {
    assert.deepEqual(detectNutrientIds('Nutrient Deficiency (Nitrogen and Potassium)'), [
      'nitrogen',
      'potassium',
    ]);
    assert.equal(
      shouldSplitNutrientIssue('Nutrient Deficiency (Possible Nitrogen and Potassium)'),
      true
    );
  });

  it('splits combined nutrient issue into separate rows', () => {
    const base = {
      category: 'nutrient_deficiency',
      issueName: 'Nutrient Deficiency (Nitrogen and Potassium)',
      confidence: 0.82,
      observation: 'Yellowing lower leaves',
      rootCause: {
        symptoms: ['chlorosis'],
        photoSignals: ['yellow leaves'],
        soilSignals: ['low N'],
        weatherSignals: ['heavy rain'],
        conclusion: 'Nutrient Deficiency (Nitrogen and Potassium)',
      },
      evidence: {
        photoSummary: 'x',
        measurementSummary: 'y',
        soilSummary: 'z',
        weatherSummary: 'w',
        historySummary: 'h',
      },
    };

    const split = expandSeparateVisitIssues([base]);
    assert.equal(split.length, 2);
    assert.deepEqual(split.map((i) => i.issueName), [
      'Nitrogen Deficiency',
      'Potassium Deficiency',
    ]);
  });

  it('leaves single-nutrient issues unchanged', () => {
    const base = {
      category: 'nutrient_deficiency',
      issueName: 'Zinc Deficiency',
      confidence: 0.7,
      rootCause: {
        symptoms: [],
        photoSignals: [],
        soilSignals: [],
        weatherSignals: [],
        conclusion: 'Zinc Deficiency',
      },
      evidence: {
        photoSummary: '',
        measurementSummary: '',
        soilSummary: '',
        weatherSummary: '',
        historySummary: '',
      },
    };
    assert.equal(expandSeparateVisitIssues([base]).length, 1);
  });
});
