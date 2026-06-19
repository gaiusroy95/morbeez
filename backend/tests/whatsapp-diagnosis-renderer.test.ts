import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappDiagnosisRendererService } from '../src/services/whatsapp/pipeline/whatsapp-diagnosis-renderer.service.js';
import type { StructuredAdvisory } from '../src/services/ai/types.js';

const richAdvisory: StructuredAdvisory = {
  probableIssue: 'Iron deficiency (Fe)',
  confidence: 0.88,
  uncertain: false,
  severity: 'moderate',
  nutrientDeficiency: [{ nutrient: 'Iron', likelihood: 'high', signs: 'interveinal chlorosis' }],
  stressAnalysis: ['Yellowing on younger leaves'],
  treatments: [],
  dosageGuidance: [
    { product: 'Fe EDTA', rate: '2 g/L', method: 'Foliar spray', frequency: 'weekly x2' },
  ],
  precautions: ['Jar test before full tank'],
  escalationRecommended: false,
  farmerSummaryEn: 'Iron deficiency likely',
  farmerSummaryMl: '',
  recommendedProductTags: [],
  imageObservations: ['Interveinal yellowing on upper leaves', 'Veins remain green'],
  differentialDiagnosis: [
    { label: 'Nitrogen deficiency', reason: 'N deficiency usually starts on older leaves' },
  ],
  sprayTiming: 'Early morning or late evening; avoid rain within 6 hours',
  rootCorrection: 'Check soil pH — iron uptake poor above pH 7.5',
  agronomistAssessment: 'Classic Fe chlorosis pattern; foliar correction should show response in 7–10 days.',
  morbeezDataUsed: ['Soil pH 7.3', 'Humidity 78%'],
  costEstimate: [{ item: 'Fe EDTA spray', note: '~₹150–250 per acre' }],
};

describe('whatsapp diagnosis renderer', () => {
  it('renders sectioned English diagnosis with dosage table', () => {
    const text = whatsappDiagnosisRendererService.render({
      advisory: richAdvisory,
      language: 'en',
      plotLabel: 'Ginger Block A',
    });
    assert.match(text, /What I see/);
    assert.match(text, /Primary issue: Iron deficiency/);
    assert.match(text, /Less likely/);
    assert.match(text, /Fe EDTA · 2 g\/L · Foliar spray/);
    assert.match(text, /Spray timing/);
    assert.match(text, /Morbeez assessment/);
    assert.match(text, /Soil pH 7.3/);
    assert.ok(text.length > 400, 'should not truncate rich diagnosis');
  });

  it('renders Malayalam section headers', () => {
    const text = whatsappDiagnosisRendererService.render({
      advisory: richAdvisory,
      language: 'ml',
    });
    assert.match(text, /പ്രധാന പ്രശ്നം/);
    assert.match(text, /ഉടനടി നടപടി/);
  });

  it('falls back to farmerSummary when no rich sections', () => {
    const thin: StructuredAdvisory = {
      ...richAdvisory,
      imageObservations: [],
      differentialDiagnosis: [],
      dosageGuidance: [],
      sprayTiming: '',
      rootCorrection: '',
      agronomistAssessment: '',
      morbeezDataUsed: [],
    };
    const text = whatsappDiagnosisRendererService.render({ advisory: thin, language: 'en' });
    assert.match(text, /Iron deficiency likely/);
  });
});
