import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maiosKnowledgeService } from '../src/services/maios-reasoning/knowledge.service.js';
import { maiosReasoningPipelineService } from '../src/services/maios-reasoning/maios-reasoning-pipeline.service.js';
import { cropPackLoaderService } from '../src/services/crop-pack/crop-pack-loader.service.js';
import { GINGER_PACK } from '../src/domain/crop-pack/packs/ginger.pack.js';

describe('Diagnosis v17 — start flow (Bayesian, no LLM ranking)', () => {
  it('returns nextEvidence and finalReport from symptoms + weather context', async () => {
    const pkg = maiosKnowledgeService.load('ginger');
    const pack = await cropPackLoaderService.load('ginger');

    const snapshot = await maiosReasoningPipelineService.run({
      cropType: 'ginger',
      pack,
      symptomsText: 'Spindle shaped brown lesions on leaves after heavy rain',
      contextPack: { heavyRainLikely: true, highHumidityLikely: true },
      photos: [{ slot: 'new_leaf_close', status: 'captured', qualityScore: 80 }],
      hypotheses: pkg.diseaseLabels.slice(0, 3).map((label, i) => ({
        label,
        probability: i === 0 ? 35 : 20,
        source: 'M5' as const,
      })),
      eqs: 62,
      maiosRoute: 'auto_recommend',
      farmerAnswers: [
        { questionText: 'Are black dots visible inside the lesions?', answer: 'yes' },
      ],
    });

    assert.ok(snapshot);
    assert.equal(snapshot!.pipelineVersion, '17.0');
    assert.ok(snapshot!.finalReport);
    assert.ok(snapshot!.nextEvidence);
    assert.ok(['LOCK', 'CONTINUE'].includes(snapshot!.decision.action));
    assert.ok(snapshot!.posterior.some((p) => p.label.includes('blast') || p.label.includes('Pyricularia')));
  });

  it('ginger pack exposes photo slots for evidence scoring', () => {
    assert.ok(GINGER_PACK.photoSlots.length >= 8);
  });
});
