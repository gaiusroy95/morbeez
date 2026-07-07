import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFusedCandidates,
  diagnosisLabelsMatch,
  pickFusedPrimary,
} from '../src/services/maios-reasoning/diagnosis-fusion.service.js';
import type { MaiosReasoningSnapshot } from '../src/domain/maios-reasoning/types.js';
import { hasPestSilverStreakEvidence } from '../src/services/maios-reasoning/symptom-evidence-patterns.js';

describe('diagnosis fusion', () => {
  it('matches labels by token overlap using generic strings only', () => {
    assert.ok(diagnosisLabelsMatch('Foliar lesion pattern A (early)', 'Early foliar lesion pattern A'));
    assert.ok(!diagnosisLabelsMatch('Uptake stress syndrome', 'Canopy moisture injury'));
  });

  it('does not treat bare "streak" alone as silver pest scraping evidence', () => {
    assert.equal(hasPestSilverStreakEvidence('yellow streak along leaf margin', 'ginger'), false);
    assert.equal(hasPestSilverStreakEvidence('silvery scraping streaks on upper leaf', 'ginger'), true);
  });

  it('prefers top-ranked differential when it outranks stated probableIssue', () => {
    const advisory = {
      probableIssue: 'Hypothesis X',
      confidence: 0.62,
      uncertain: false,
      nutrientDeficiency: [],
      stressAnalysis: [],
      treatments: [],
      dosageGuidance: [],
      precautions: [],
      escalationRecommended: false,
      farmerSummaryEn: '',
      farmerSummaryMl: '',
      recommendedProductTags: [],
      differentialDiagnosis: [
        { label: 'Hypothesis Y', reason: 'stronger visual fit', probability: 0.78 },
        { label: 'Hypothesis X', reason: 'weaker fit', probability: 0.15 },
      ],
    };

    const posterior = [
      { label: 'Hypothesis X', probability: 0.34 },
      { label: 'Hypothesis Z', probability: 0.22 },
      { label: 'Unknown', probability: 0.1 },
    ];

    const candidates = buildFusedCandidates({ posterior, advisory });
    const reasoning = {
      shadowMode: false,
      decision: {
        action: 'CONTINUE' as const,
        topLabel: 'Hypothesis X',
        topConfidence: 0.34,
        threshold: 0.85,
        evidenceCount: 2,
        reviewRequired: false,
        reason: '',
      },
      explanation: {
        diagnosis: 'Hypothesis X',
        confidence: 0.34,
        supporting: [],
        rejected: [],
        missing: [],
      },
      posterior,
      evidence: [],
    } as MaiosReasoningSnapshot;

    const primary = pickFusedPrimary({ candidates, reasoning, advisory });
    assert.ok(diagnosisLabelsMatch(primary.label, 'Hypothesis Y'));
    assert.ok(primary.confidence >= 0.55);
  });
});
