import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBayesianDiagnosisToAdvisory,
  buildWhatsAppVisionObservations,
} from '../src/services/maios-reasoning/crop-doctor-reasoning-bridge.service.js';
import type { MaiosCase } from '../src/domain/case/types.js';
import type { MaiosReasoningSnapshot } from '../src/domain/maios-reasoning/types.js';

describe('WhatsApp crop-doctor reasoning bridge', () => {
  it('extracts vision features from imageObservations text', () => {
    const obs = buildWhatsAppVisionObservations({
      advisory: {
        probableIssue: 'Leaf spot',
        confidence: 0.6,
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
        imageObservations: ['Spindle shaped brown lesions with grey center on new leaves'],
      },
    });
    assert.ok(obs.some((o) => o.feature === 'spindle_shape'));
    assert.ok(obs.some((o) => o.feature === 'grey_center'));
  });

  it('demotes LLM probableIssue when shadow mode is off and treatment aligns with weak blast', () => {
    const advisory = {
      probableIssue: 'Nutrient deficiency',
      confidence: 0.82,
      uncertain: false,
      nutrientDeficiency: [],
      stressAnalysis: [],
      treatments: [{ action: 'Apply potash through fertigation' }],
      dosageGuidance: [{ product: 'MOP', rate: '20 kg/acre', method: 'Fertigation' }],
      precautions: [],
      escalationRecommended: false,
      farmerSummaryEn: 'Your leaves look yellow.',
      farmerSummaryMl: 'Test',
      recommendedProductTags: [],
      differentialDiagnosis: [{ label: 'Nutrient deficiency', reason: 'LLM guess', probability: 0.82 }],
    };

    const reasoning = {
      shadowMode: false,
      decision: {
        action: 'CONTINUE' as const,
        topLabel: 'Pyricularia leaf blast',
        topConfidence: 0.26,
        threshold: 0.85,
        evidenceCount: 4,
        reviewRequired: false,
        reason: 'Continue',
      },
      explanation: {
        diagnosis: 'Pyricularia leaf blast',
        confidence: 0.26,
        supporting: ['High humidity'],
        rejected: ['Nutrient deficiency'],
        missing: ['Rhizome photo'],
      },
      posterior: [
        { label: 'Pyricularia leaf blast', probability: 0.26 },
        { label: 'Nutrient deficiency', probability: 0.24 },
        { label: 'Unknown', probability: 0.12 },
      ],
    } as MaiosReasoningSnapshot;

    const maiosCase = { reasoning } as MaiosCase;
    const out = applyBayesianDiagnosisToAdvisory(advisory, maiosCase);

    assert.equal(out.probableIssue, 'Nutrient deficiency');
    assert.ok(out.diagnosisHeadline?.includes('Nutrient deficiency'));
    assert.ok(out.diagnosisRanked?.length);
    assert.ok(out.treatmentAlignmentNote?.includes('nutrition') || out.diseaseWatchNote);
  });

  it('leaves advisory unchanged in shadow mode', () => {
    const advisory = {
      probableIssue: 'Thrips',
      confidence: 0.75,
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
    };
    const reasoning = {
      shadowMode: true,
      decision: {
        action: 'CONTINUE' as const,
        topLabel: 'Pyricularia leaf blast',
        topConfidence: 0.6,
        threshold: 0.85,
        evidenceCount: 2,
        reviewRequired: false,
        reason: '',
      },
      explanation: {
        diagnosis: 'Pyricularia leaf blast',
        confidence: 0.6,
        supporting: [],
        rejected: [],
        missing: [],
      },
      posterior: [],
    } as MaiosReasoningSnapshot;

    const out = applyBayesianDiagnosisToAdvisory(advisory, { reasoning } as MaiosCase);
    assert.equal(out.probableIssue, 'Thrips');
    assert.equal(out.confidence, 0.75);
  });
});
