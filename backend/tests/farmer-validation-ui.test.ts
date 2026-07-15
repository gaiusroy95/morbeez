import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFarmerExperienceSections,
  formatActiveIngredientLine,
  parseFarmerActiveIngredients,
  resolveFarmerAiMatchStatus,
} from '../../packages/shared/src/visit-wizard/farmer-validation-ui.js';

describe('farmer validation UI helpers', () => {
  it('parses active ingredients from farmer product text', () => {
    const text =
      'EDTA zinc, EDTA ferrous, EDTA calcium, each at 200g, magnesium sulfate at 1kg, ammonium sulfate per 200 liters as a spray';
    const items = parseFarmerActiveIngredients(text, null);
    assert.ok(items.some((i) => /EDTA Fe/i.test(i.label)));
    assert.ok(items.some((i) => /EDTA Zn/i.test(i.label)));
    assert.ok(items.some((i) => /Magnesium sulphate/i.test(i.label)));
  });

  it('formats ingredient lines for display', () => {
    const line = formatActiveIngredientLine({ label: 'EDTA Zn', dose: '200 g', method: 'foliar spray' });
    assert.match(line, /EDTA Zn/);
    assert.match(line, /200 g/);
  });

  it('detects match vs conflict between AI and farmer labels', () => {
    assert.equal(resolveFarmerAiMatchStatus('Iron (Fe) deficiency', 'Iron (Fe) deficiency'), 'match');
    assert.equal(resolveFarmerAiMatchStatus('Anthracnose', 'Magnesium (Mg) deficiency'), 'conflict');
  });

  it('builds structured farmer experience sections', () => {
    const sections = buildFarmerExperienceSections({
      suggestedDiagnoses: ['Iron (Fe) deficiency', 'Zinc (Zn) deficiency'],
      priorProduct: 'EDTA zinc at 200g',
      priorOutcome: 'partial',
    });
    assert.equal(sections.observations.length, 2);
    assert.ok(sections.activeIngredients.length >= 1);
    assert.equal(sections.responseAfterApplication, 'partial');
  });
});
