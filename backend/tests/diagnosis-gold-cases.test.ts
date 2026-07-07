import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GINGER_GOLD_CASES } from '../src/domain/diagnosis/gold-cases/ginger.gold.js';
import { BANANA_GOLD_CASES } from '../src/domain/diagnosis/gold-cases/banana.gold.js';
import { TOMATO_GOLD_CASES } from '../src/domain/diagnosis/gold-cases/tomato.gold.js';
import { COCONUT_GOLD_CASES } from '../src/domain/diagnosis/gold-cases/coconut.gold.js';
import { BRINJAL_GOLD_CASES } from '../src/domain/diagnosis/gold-cases/brinjal.gold.js';
import { maiosContextEvidenceService } from '../src/services/maios-reasoning/context-evidence.service.js';
import { maiosEvidenceRepositoryService } from '../src/services/maios-reasoning/evidence-repository.service.js';
import { maiosBayesianEngineService } from '../src/services/maios-reasoning/bayesian-engine.service.js';
import { maiosKnowledgeService } from '../src/services/maios-reasoning/knowledge.service.js';
import { maiosReasoningPipelineService } from '../src/services/maios-reasoning/maios-reasoning-pipeline.service.js';
import { cropPackLoaderService } from '../src/services/crop-pack/crop-pack-loader.service.js';
import { GINGER_KNOWLEDGE_V1 } from '../src/domain/maios-reasoning/knowledge/ginger.v1.js';

async function runGoldCase(caseDef: (typeof GINGER_GOLD_CASES)[number]) {
  const pack = await cropPackLoaderService.load(caseDef.cropType);
  const pkg = maiosKnowledgeService.load(caseDef.cropType);

  const contextItems = maiosContextEvidenceService.build({
    cropType: caseDef.cropType,
    symptomsText: caseDef.symptomsText,
    contextPack: caseDef.contextPack,
  });

  const photos = (caseDef.photoSlots ?? []).map((slot) => ({
    slot,
    status: 'captured' as const,
    qualityScore: 82,
  }));

  const evidence = maiosEvidenceRepositoryService.merge({
    contextItems,
    visionLabel: caseDef.visionLabel,
    visionConfidence: caseDef.visionConfidence,
    photos,
    pack,
    farmerAnswers: caseDef.farmerAnswers,
  });

  const prior = maiosBayesianEngineService.buildPrior(pkg);
  const posterior = maiosBayesianEngineService.update(pkg, prior, evidence);

  const snapshot = await maiosReasoningPipelineService.run({
    cropType: caseDef.cropType,
    pack,
    symptomsText: caseDef.symptomsText,
    contextPack: caseDef.contextPack,
    photos,
    hypotheses: pkg.diseaseLabels.slice(0, 4).map((label, i) => ({
      label,
      probability: 30 - i * 5,
      source: 'M5' as const,
    })),
    eqs: Math.min(85, 45 + photos.length * 12 + (caseDef.farmerAnswers?.length ?? 0) * 8),
    maiosRoute: 'auto_recommend',
    visionLabel: caseDef.visionLabel,
    visionConfidence: caseDef.visionConfidence,
    farmerAnswers: caseDef.farmerAnswers,
  });

  return { posterior, evidence, snapshot };
}

describe('Diagnosis gold cases — ginger v17 regression', () => {
  for (const gold of GINGER_GOLD_CASES) {
    it(`${gold.id}: ${gold.label}`, async () => {
      const { posterior, evidence, snapshot } = await runGoldCase(gold);
      const top = posterior[0];
      assert.ok(top, `${gold.id}: empty posterior`);

      assert.ok(
        top.label.toLowerCase().includes(gold.expect.topDiagnosisIncludes.toLowerCase()),
        `${gold.id}: expected top to include "${gold.expect.topDiagnosisIncludes}", got "${top.label}" (${top.probability})`
      );
      assert.ok(
        top.probability >= gold.expect.minTopProbability,
        `${gold.id}: expected top probability >= ${gold.expect.minTopProbability}, got ${top.probability}`
      );

      if (gold.expect.minReliableEvidence != null) {
        const reliable = evidence.filter(
          (e) => e.reliability >= 0.7 && !e.key.startsWith('photo:missing')
        );
        assert.ok(
          reliable.length >= gold.expect.minReliableEvidence,
          `${gold.id}: expected >= ${gold.expect.minReliableEvidence} reliable evidence, got ${reliable.length}`
        );
      }

      assert.ok(snapshot?.finalReport, `${gold.id}: missing finalReport`);
    });
  }

  it('gold harness uses expert-governed ginger knowledge v1', () => {
    assert.equal(GINGER_KNOWLEDGE_V1.version, '1.0');
    assert.ok(GINGER_GOLD_CASES.length >= 4);
    assert.ok(BANANA_GOLD_CASES.length >= 4);
  });
});

describe('Diagnosis gold cases — banana v1 regression', () => {
  for (const gold of BANANA_GOLD_CASES) {
    it(`${gold.id}: ${gold.label}`, async () => {
      const { posterior, snapshot } = await runGoldCase(gold);
      const top = posterior[0];
      assert.ok(top, `${gold.id}: empty posterior`);
      assert.ok(
        top.label.toLowerCase().includes(gold.expect.topDiagnosisIncludes.toLowerCase()),
        `${gold.id}: expected "${gold.expect.topDiagnosisIncludes}", got "${top.label}"`
      );
      assert.ok(top.probability >= gold.expect.minTopProbability);
      assert.ok(snapshot?.finalReport);
    });
  }
});

describe('Diagnosis gold cases — tomato v1 regression', () => {
  for (const gold of TOMATO_GOLD_CASES) {
    it(`${gold.id}: ${gold.label}`, async () => {
      const { posterior, snapshot } = await runGoldCase(gold);
      const top = posterior[0];
      assert.ok(top, `${gold.id}: empty posterior`);
      assert.ok(
        top.label.toLowerCase().includes(gold.expect.topDiagnosisIncludes.toLowerCase()),
        `${gold.id}: expected "${gold.expect.topDiagnosisIncludes}", got "${top.label}"`
      );
      assert.ok(top.probability >= gold.expect.minTopProbability);
      assert.ok(snapshot?.finalReport);
    });
  }
});

describe('Diagnosis gold cases — coconut v1 regression', () => {
  for (const gold of COCONUT_GOLD_CASES) {
    it(`${gold.id}: ${gold.label}`, async () => {
      const { posterior, snapshot } = await runGoldCase(gold);
      const top = posterior[0];
      assert.ok(top, `${gold.id}: empty posterior`);
      assert.ok(
        top.label.toLowerCase().includes(gold.expect.topDiagnosisIncludes.toLowerCase()),
        `${gold.id}: expected "${gold.expect.topDiagnosisIncludes}", got "${top.label}"`
      );
      assert.ok(top.probability >= gold.expect.minTopProbability);
      assert.ok(snapshot?.finalReport);
    });
  }
});

describe('Diagnosis gold cases — brinjal v1 regression', () => {
  for (const gold of BRINJAL_GOLD_CASES) {
    it(`${gold.id}: ${gold.label}`, async () => {
      const { posterior, snapshot } = await runGoldCase(gold);
      const top = posterior[0];
      assert.ok(top, `${gold.id}: empty posterior`);
      assert.ok(
        top.label.toLowerCase().includes(gold.expect.topDiagnosisIncludes.toLowerCase()),
        `${gold.id}: expected "${gold.expect.topDiagnosisIncludes}", got "${top.label}"`
      );
      assert.ok(top.probability >= gold.expect.minTopProbability);
      assert.ok(snapshot?.finalReport);
    });
  }
});
