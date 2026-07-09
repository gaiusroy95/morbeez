import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTreatmentSection,
  formatVisitRecommendationText,
} from '../src/services/ai/treatment-report-formatter.js';
import type { StructuredAdvisory } from '../src/services/ai/types.js';

const base: StructuredAdvisory = {
  probableIssue: 'Nutrient deficiency',
  confidence: 0.8,
  uncertain: false,
  nutrientDeficiency: [],
  stressAnalysis: [],
  treatments: [],
  dosageGuidance: [{ product: 'Fe EDTA', rate: '2 g/L', method: 'Foliar spray' }],
  precautions: [],
  escalationRecommended: false,
  farmerSummaryEn: '',
  farmerSummaryMl: '',
  recommendedProductTags: [],
};

describe('treatment report formatter', () => {
  it('always includes connected prevention section with none message', () => {
    const lines = buildTreatmentSection(base);
    const text = lines.join('\n');
    assert.match(text, /Connected Prevention/);
    assert.match(text, /No connected preventive measures/);
  });

  it('formats visit recommendation with recovery and monitor', () => {
    const text = formatVisitRecommendationText({
      ...base,
      connectedPrevention: [
        {
          connectedRisk: 'Pyricularia leaf blast',
          preventiveProduct: 'Tricyclazole',
          dose: '0.5 g/L',
          method: 'Foliar spray',
          reason: 'Prior blast history with humid wet weather.',
          riskLevel: 'high',
        },
      ],
      recoveryReason: 'New leaves should regain colour within 7–10 days after soil drains.',
      monitorAdvice: 'Watch for spindle-shaped brown lesions on new leaves.',
    });
    assert.match(text, /Tricyclazole/);
    assert.match(text, /7–10 days/);
    assert.match(text, /Watch for spindle-shaped/);
    assert.doesNotMatch(text, /No connected preventive measures are currently recommended/);
  });
});
