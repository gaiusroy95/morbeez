import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { plantIdVisionFeaturesService } from '../src/services/maios-reasoning/plant-id-vision-features.service.js';
import { maiosEvidenceRepositoryService } from '../src/services/maios-reasoning/evidence-repository.service.js';
import { GINGER_PACK } from '../src/domain/crop-pack/packs/ginger.pack.js';

describe('Plant.id structured vision — multi-crop features', () => {
  it('infers tomato concentric rings from Alternaria label', () => {
    const obs = plantIdVisionFeaturesService.inferFromLabel('Alternaria early blight', 0.85, 'tomato');
    assert.ok(obs.some((o) => o.feature === 'concentric_rings'));
  });

  it('infers banana sigatoka streaks from disease name', () => {
    const obs = plantIdVisionFeaturesService.inferFromLabel('Mycosphaerella sigatoka leaf spot', 0.8, 'banana');
    assert.ok(obs.some((o) => o.feature === 'yellow_streak' || o.feature === 'parallel_streak'));
  });

  it('infers coconut bud rot from Phytophthora label', () => {
    const obs = plantIdVisionFeaturesService.inferFromLabel('Phytophthora bud rot', 0.82, 'coconut');
    assert.ok(obs.some((o) => o.feature === 'bud_rot'));
  });

  it('infers brinjal shoot borer from Plant.id-style disease name', () => {
    const obs = plantIdVisionFeaturesService.inferFromLabel('Leucinodes orbonalis shoot borer', 0.78, 'brinjal');
    assert.ok(obs.some((o) => o.feature === 'borer_hole'));
  });

  it('maps tomato water-soaked feature to LR evidence key', () => {
    const evidence = maiosEvidenceRepositoryService.merge({
      contextItems: [],
      photos: [],
      pack: GINGER_PACK,
      cropType: 'tomato',
      visionFeatures: [{ feature: 'water_soaked', value: 'present', confidence: 0.9 }],
    });
    assert.ok(evidence.some((e) => e.key === 'symptom:water_soaked'));
  });

  it('merges multiple Plant.id disease suggestions', () => {
    const obs = plantIdVisionFeaturesService.inferFromPlantIdResult(
      {
        diseases: [
          { name: 'Late blight', probability: 0.72 },
          { name: 'Early blight Alternaria', probability: 0.35 },
        ],
        isHealthy: false,
        raw: {},
      },
      'tomato'
    );
    assert.ok(obs.some((o) => o.feature === 'water_soaked'));
    assert.ok(obs.some((o) => o.feature === 'concentric_rings'));
  });
});
