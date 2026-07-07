import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diagnosisPresentationService,
  inferTreatmentFocus,
} from '../src/services/maios-reasoning/diagnosis-presentation.service.js';
import { diagnosisLabelsMatch } from '../src/services/maios-reasoning/diagnosis-fusion.service.js';
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
  it('infers nutrient focus from fertigation product text', () => {
    const focus = inferTreatmentFocus(
      baseAdvisory({
        dosageGuidance: [{ product: 'Muriate of Potash', rate: '25 kg/acre', method: 'Fertigation' }],
        rootCorrection: 'Split NPK doses through drip',
      })
    );
    assert.equal(focus, 'nutrient');
  });

  it('may elevate nutrient label when context evidence supports it over a weak disease posterior', () => {
    const weakDisease = 'Fungal canopy lesion';
    const advisory = baseAdvisory({
      probableIssue: 'Nutrient deficiency',
      dosageGuidance: [{ product: 'MOP (Potash)', rate: '20 kg/acre', method: 'Fertigation' }],
      treatments: [{ action: 'Apply potassium through drip', timing: 'within 3 days' }],
    });

    const reasoning = {
      shadowMode: false,
      decision: {
        action: 'CONTINUE' as const,
        topLabel: weakDisease,
        topConfidence: 0.26,
        threshold: 0.85,
        evidenceCount: 3,
        reviewRequired: false,
        reason: '',
      },
      explanation: {
        diagnosis: weakDisease,
        confidence: 0.26,
        supporting: ['High humidity'],
        rejected: [],
        missing: [],
      },
      posterior: [
        { label: weakDisease, probability: 0.26 },
        { label: 'Nutrient deficiency', probability: 0.24 },
        { label: 'Unknown', probability: 0.1 },
      ],
      evidence: [
        { key: 'context:k_demand_stage', label: 'K demand', source: 'context', reliability: 0.88 },
        { key: 'context:fertilizer_gap_21d', label: 'Fert gap', source: 'context', reliability: 0.82 },
      ],
    } as MaiosReasoningSnapshot;

    const presentation = diagnosisPresentationService.build({
      advisory,
      reasoning,
      shadowMode: false,
    });

    assert.ok(diagnosisLabelsMatch(presentation.primaryLabel, 'Nutrient deficiency'));
    assert.ok(presentation.primaryConfidence >= 0.5);
    assert.ok(presentation.diseaseWatch);
    assert.ok(diagnosisLabelsMatch(presentation.diseaseWatch!.label, weakDisease));

    const out = diagnosisPresentationService.applyToAdvisory(advisory, presentation, reasoning);
    assert.ok(diagnosisLabelsMatch(out.probableIssue, 'Nutrient deficiency'));
    assert.ok(out.diagnosisRanked?.some((r) => r.role === 'primary'));
  });

  it('uses low-confidence headline wording when posterior is weak', () => {
    const weakPrimary = 'Fungal canopy lesion';
    const advisory = baseAdvisory({
      probableIssue: weakPrimary,
      confidence: 0.26,
      treatments: [{ action: 'Apply fungicide spray', timing: 'evening' }],
    });

    const reasoning = {
      shadowMode: false,
      decision: {
        action: 'CONTINUE' as const,
        topLabel: weakPrimary,
        topConfidence: 0.26,
        threshold: 0.85,
        evidenceCount: 2,
        reviewRequired: false,
        reason: '',
      },
      explanation: {
        diagnosis: weakPrimary,
        confidence: 0.26,
        supporting: [],
        rejected: [],
        missing: [],
      },
      posterior: [
        { label: weakPrimary, probability: 0.26 },
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
