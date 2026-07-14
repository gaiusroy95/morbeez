import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPriorProduct,
  extractSuggestedDiagnosis,
  extractAllSuggestedDiagnoses,
  isFarmerDisagreementIntent,
} from '../src/services/core/farmer-feedback-intent.service.js';
import {
  mapFarmerSuggestionInput,
  isFarmerSuggestionButtonId,
  extractAllFarmerSuggestedDiagnoses,
  getFarmerSuggestedDiagnosesFromStored,
  looksLikeDescriptiveHypothesis,
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

  it('splits multi-nutrient farmer free text into separate issues (not one combined string)', () => {
    const msg =
      "It's a ferrous, zinc, magnesium, and nitrogen deficiency, and the connected issue is that the leaves get thinner. So, calcium needs to be supplied.";
    const all = extractAllFarmerSuggestedDiagnoses(msg);
    assert.equal(all.length, 5);
    assert.deepEqual(all, [
      'Iron (Fe) deficiency',
      'Zinc (Zn) deficiency',
      'Magnesium (Mg) deficiency',
      'Nitrogen (N) deficiency',
      'Calcium (Ca) deficiency',
    ]);
    assert.equal(extractAllSuggestedDiagnoses(msg).length, 5);
    assert.equal(extractSuggestedDiagnosis(msg), 'Iron (Fe) deficiency');
    assert.ok(!extractSuggestedDiagnosis(msg)?.includes(';'));
  });

  it('reads diagnoses array from feedback metadata', () => {
    const stored = getFarmerSuggestedDiagnosesFromStored({
      farmer_suggested_diagnosis: 'Iron (Fe) deficiency',
      metadata: {
        farmer_suggested_diagnoses: [
          'Iron (Fe) deficiency',
          'Zinc (Zn) deficiency',
          'Magnesium (Mg) deficiency',
        ],
      },
    });
    assert.equal(stored.length, 3);
    assert.equal(stored[1], 'Zinc (Zn) deficiency');
  });

  it('splits potash + anthracnose + calcium descriptive hypothesis into separate conditions', () => {
    const msg =
      'There is a potash deficiency connected to a fungal attack, probably anthracnose, and a calcium deficiency, leading to less leaf thickness.';
    const all = extractAllFarmerSuggestedDiagnoses(msg);
    assert.ok(all.includes('Potassium (K) deficiency'));
    assert.ok(all.includes('Anthracnose (Colletotrichum)'));
    assert.ok(all.includes('Calcium (Ca) deficiency'));
    assert.ok(all.includes('Fungal infection') || all.some((d) => /fungal|anthracnose/i.test(d)));
    assert.equal(all.includes(msg), false);
  });

  it('detects descriptive multi-factor hypotheses', () => {
    assert.equal(looksLikeDescriptiveHypothesis('feedback.suggest.iron'), false);
    assert.equal(
      looksLikeDescriptiveHypothesis(
        'There is a potash deficiency connected to a fungal attack, probably anthracnose, and a calcium deficiency.'
      ),
      true
    );
  });

  it('prefers refined assessment labels when reading stored feedback', () => {
    const stored = getFarmerSuggestedDiagnosesFromStored({
      farmer_suggested_diagnosis: 'Iron (Fe) deficiency',
      metadata: {
        farmer_suggested_diagnoses: ['Iron (Fe) deficiency'],
        farmer_refined_assessment: {
          conditions: [
            { label: 'Potassium (K) deficiency', probability: 0.8 },
            { label: 'Anthracnose (Colletotrichum)', probability: 0.35 },
            { label: 'Calcium (Ca) deficiency', probability: 0.25 },
          ],
        },
      },
    });
    assert.deepEqual(stored, [
      'Potassium (K) deficiency',
      'Anthracnose (Colletotrichum)',
      'Calcium (Ca) deficiency',
    ]);
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
