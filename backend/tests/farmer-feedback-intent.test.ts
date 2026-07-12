import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPriorProduct,
  extractSuggestedDiagnosis,
  isFarmerDisagreementIntent,
} from '../src/services/core/farmer-feedback-intent.service.js';
import {
  mapFarmerSuggestionInput,
  isFarmerSuggestionButtonId,
} from '../src/domain/learning/farmer-nutrient-suggestions.js';

describe('farmer feedback intent', () => {
  it('detects disagreement phrases', () => {
    assert.equal(isFarmerDisagreementIntent('AI wrong'), true);
    assert.equal(isFarmerDisagreementIntent('This is not fungus'), true);
    assert.equal(isFarmerDisagreementIntent('I already had this last year'), true);
    assert.equal(isFarmerDisagreementIntent('hello menu'), false);
  });

  it('extracts suggested diagnosis and product', () => {
    assert.match(extractSuggestedDiagnosis('This is thrips') ?? '', /thrips/i);
    assert.match(extractPriorProduct('Last time spinetoram worked') ?? '', /spinetoram/i);
  });

  it('maps farmer nutrient suggestion chips to diagnoses', () => {
    assert.equal(mapFarmerSuggestionInput('feedback.suggest.iron'), 'Iron (Fe) deficiency');
    assert.equal(mapFarmerSuggestionInput('feedback.suggest.zinc'), 'Zinc (Zn) deficiency');
    assert.equal(mapFarmerSuggestionInput('feedback.suggest.magnesium'), 'Magnesium (Mg) deficiency');
    assert.equal(mapFarmerSuggestionInput('feedback.suggest.nitrogen'), 'Nitrogen (N) deficiency');
    assert.equal(mapFarmerSuggestionInput('feedback.suggest.other'), null);
    assert.equal(mapFarmerSuggestionInput('Zinc deficiency'), 'Zinc (Zn) deficiency');
    assert.equal(isFarmerSuggestionButtonId('feedback.suggest.iron'), true);
    assert.equal(isFarmerDisagreementIntent('feedback.suggest.nitrogen'), true);
    assert.equal(extractSuggestedDiagnosis('feedback.suggest.iron'), 'Iron (Fe) deficiency');
  });
});
