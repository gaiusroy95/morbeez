import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { visitVisionObservationsService } from '../src/services/maios-reasoning/visit-vision-observations.service.js';
import { maiosEvidenceRepositoryService } from '../src/services/maios-reasoning/evidence-repository.service.js';
import { applyBayesianToVisitHypotheses } from '../src/services/maios-reasoning/maios-reasoning-adapter.service.js';
import { GINGER_PACK } from '../src/domain/crop-pack/packs/ginger.pack.js';
import type { MaiosReasoningSnapshot } from '../src/domain/maios-reasoning/types.js';

describe('Domain 2 — structured vision observations', () => {
  it('infers spindle and grey center from blast label', () => {
    const obs = visitVisionObservationsService.inferFromLabel('Pyricularia leaf blast', 0.9);
    assert.ok(obs.some((o) => o.feature === 'spindle_shape' && o.value === 'present'));
    assert.ok(obs.some((o) => o.feature === 'grey_center'));
  });

  it('maps vision features to LR evidence keys in repository', () => {
    const evidence = maiosEvidenceRepositoryService.merge({
      contextItems: [],
      photos: [],
      pack: GINGER_PACK,
      visionFeatures: [{ feature: 'spindle_shape', value: 'present', confidence: 0.96 }],
    });
    assert.ok(evidence.some((e) => e.key === 'symptom:spindle_lesion'));
  });

  it('parses structured vision JSON observations', () => {
    const obs = visitVisionObservationsService.parseStructuredResponse({
      observations: [
        { feature: 'black_dots', value: 'present', confidence: 0.92 },
        { feature: 'grey_center', value: 'absent', confidence: 0.2 },
      ],
    });
    assert.equal(obs.length, 1);
    assert.equal(obs[0]?.feature, 'black_dots');
  });
});

describe('Visit LLM demotion — Bayesian hypothesis ranking', () => {
  it('keeps LLM order in shadow mode', () => {
    const original = [
      { label: 'Nutrient deficiency', confidence: 0.7, rationale: 'LLM' },
      { label: 'Pyricularia leaf blast', confidence: 0.65, rationale: 'LLM' },
    ];
    const snapshot = {
      shadowMode: true,
      posterior: [
        { label: 'Pyricularia leaf blast', probability: 0.72 },
        { label: 'Nutrient deficiency', probability: 0.12 },
      ],
    } as MaiosReasoningSnapshot;
    const out = applyBayesianToVisitHypotheses(original, snapshot);
    assert.equal(out[0]?.label, 'Nutrient deficiency');
  });

  it('re-ranks by Bayesian posterior when shadow mode off', () => {
    const original = [
      { label: 'Nutrient deficiency', confidence: 0.7, rationale: 'LLM' },
      { label: 'Pyricularia leaf blast', confidence: 0.65, rationale: 'LLM' },
    ];
    const snapshot = {
      shadowMode: false,
      posterior: [
        { label: 'Pyricularia leaf blast', probability: 0.72 },
        { label: 'Nutrient deficiency', probability: 0.12 },
        { label: 'Unknown', probability: 0.05 },
      ],
    } as MaiosReasoningSnapshot;
    const out = applyBayesianToVisitHypotheses(original, snapshot);
    assert.equal(out[0]?.label, 'Pyricularia leaf blast');
    assert.ok(out[0]!.confidence > out[1]!.confidence);
  });
});
