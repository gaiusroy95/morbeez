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
    assert.match(mapFarmerSuggestionInput('Zinc deficiency') ?? '', /Zinc/);
    assert.equal(isFarmerSuggestionButtonId('feedback.suggest.iron'), true);
    assert.equal(isFarmerDisagreementIntent('feedback.suggest.nitrogen'), true);
    assert.equal(extractSuggestedDiagnosis('feedback.suggest.iron'), 'Iron (Fe) deficiency');
  });

  it('keeps multi-nutrient farmer free text (does not collapse to one nutrient)', () => {
    const msg =
      "It's a ferrous, zinc, magnesium, and nitrogen deficiency, and the connected issue is that the leaves get thinner. So, calcium needs to be supplied.";
    const dx = extractSuggestedDiagnosis(msg) ?? '';
    assert.match(dx, /Iron/i);
    assert.match(dx, /Zinc/i);
    assert.match(dx, /Magnesium/i);
    assert.match(dx, /Nitrogen/i);
    assert.match(dx, /calcium/i);
  });

  it('extracts EDTA / sulfate products from farmer treatment history', () => {
    const treatment =
      'I applied EDTA zinc ferrous, EDTA calcium, and EDTA zinc, each at 200g, and magnesium sulfate at 1kg, along with ammonium sulfate per 200 liters as a spray.';
    const products = extractPriorProduct(treatment) ?? '';
    assert.match(products, /EDTA zinc/i);
    assert.match(products, /EDTA ferrous/i);
    assert.match(products, /EDTA calcium/i);
    assert.match(products, /magnesium sulfate/i);
    assert.match(products, /ammonium sulfate/i);
  });
});
