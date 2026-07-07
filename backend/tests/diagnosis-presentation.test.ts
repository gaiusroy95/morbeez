import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diagnosisPresentationService,
  inferTreatmentFocus,
} from '../src/services/maios-reasoning/diagnosis-presentation.service.js';
import type { StructuredAdvisory } from '../src/services/ai/types.js';
import type { MaiosReasoningSnapshot } from '../src/domain/maios-reasoning/types.js';

function baseAdvisory(overrides: Partial<StructuredAdvisory> = {}): StructuredAdvisory {
  return {
    probableIssue: 'Nutrient deficiency',
    confidence: 0.72,
    uncertain: false,
    nutrientDeficiency: [],
    stressAnalysis: [],
    treatments: [],
    dosageGuidance: [],
    precautions: [],
    escalationRecommended: false,
    farmerSummaryEn: 'Test',
    farmerSummaryMl: 'Test',
    recommendedProductTags: [],
    ...overrides,
  };
}

describe('diagnosis presentation layer', () => {
  it('infers nutrient focus from potash / fertigation recommendations', () => {
    const focus = inferTreatmentFocus(
      baseAdvisory({
        dosageGuidance: [{ product: 'Muriate of Potash', rate: '25 kg/acre', method: 'Fertigation' }],
        rootCorrection: 'Split NPK doses through drip',
      })
    );
    assert.equal(focus, 'nutrient');
  });

  it('prefers nutrient primary when weak blast posterior conflicts with potash treatment', () => {
    const advisory = baseAdvisory({
      probableIssue: 'Nutrient deficiency (K)',
      dosageGuidance: [{ product: 'MOP (Potash)', rate: '20 kg/acre', method: 'Fertigation' }],
      treatments: [{ action: 'Apply potassium through drip', timing: 'within 3 days' }],
    });

    const reasoning = {
      shadowMode: false,
      decision: {
        action: 'CONTINUE' as const,
        topLabel: 'Pyricularia leaf blast',
        topConfidence: 0.26,
        threshold: 0.85,
        evidenceCount: 3,
        reviewRequired: false,
        reason: '',
      },
      explanation: {
        diagnosis: 'Pyricularia leaf blast',
        confidence: 0.26,
        supporting: ['High humidity'],
        rejected: [],
        missing: [],
      },
      posterior: [
        { label: 'Pyricularia leaf blast', probability: 0.26 },
        { label: 'Nutrient deficiency', probability: 0.24 },
        { label: 'Thrips', probability: 0.12 },
        { label: 'Unknown', probability: 0.1 },
      ],
    } as MaiosReasoningSnapshot;

    const presentation = diagnosisPresentationService.build({
      advisory,
      reasoning,
      shadowMode: false,
    });

    assert.equal(presentation.primaryLabel, 'Nutrient deficiency');
    assert.ok(presentation.showLowConfidencePrimary);
    assert.ok(presentation.diseaseWatch?.label.toLowerCase().includes('blast'));
    assert.ok(presentation.alignmentNote?.includes('nutrition'));

    const out = diagnosisPresentationService.applyToAdvisory(advisory, presentation, reasoning);
    assert.equal(out.probableIssue, 'Nutrient deficiency');
    assert.ok(out.diagnosisHeadline?.includes('Nutrient deficiency'));
    assert.ok(out.diagnosisRanked?.some((r) => r.role === 'primary'));
  });

  it('does not label weak posterior as confident primary headline', () => {
    const advisory = baseAdvisory({
      probableIssue: 'Pyricularia leaf blast',
      treatments: [{ action: 'Apply Mancozeb', timing: 'evening' }],
    });

    const reasoning = {
      shadowMode: false,
      decision: {
        action: 'CONTINUE' as const,
        topLabel: 'Pyricularia leaf blast',
        topConfidence: 0.26,
        threshold: 0.85,
        evidenceCount: 2,
        reviewRequired: false,
        reason: '',
      },
      explanation: {
        diagnosis: 'Pyricularia leaf blast',
        confidence: 0.26,
        supporting: [],
        rejected: [],
        missing: [],
      },
      posterior: [
        { label: 'Pyricularia leaf blast', probability: 0.26 },
        { label: 'Nutrient deficiency', probability: 0.15 },
        { label: 'Unknown', probability: 0.15 },
      ],
    } as MaiosReasoningSnapshot;

    const presentation = diagnosisPresentationService.build({
      advisory,
      reasoning,
      shadowMode: false,
    });

    assert.ok(presentation.headline.includes('several factors'));
    assert.equal(presentation.primaryConfidence, 0.26);
  });
});
