import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GINGER_KNOWLEDGE_V1 } from '../src/domain/maios-reasoning/knowledge/ginger.v1.js';
import { maiosKnowledgeService } from '../src/services/maios-reasoning/knowledge.service.js';
import { maiosContextEvidenceService } from '../src/services/maios-reasoning/context-evidence.service.js';
import { maiosEvidenceRepositoryService } from '../src/services/maios-reasoning/evidence-repository.service.js';
import { maiosBayesianEngineService } from '../src/services/maios-reasoning/bayesian-engine.service.js';
import { maiosEvsiEngineService } from '../src/services/maios-reasoning/evsi-engine.service.js';
import { maiosDecisionEngineService } from '../src/services/maios-reasoning/decision-engine.service.js';
import { maiosExplainabilityEngineService } from '../src/services/maios-reasoning/explainability-engine.service.js';
import { maiosReasoningPipelineService } from '../src/services/maios-reasoning/maios-reasoning-pipeline.service.js';
import { maiosScientificManagementService } from '../src/services/maios-reasoning/scientific-management.service.js';
import { maiosSafetyEngineService } from '../src/services/maios-reasoning/safety-engine.service.js';
import { maiosFinalReportService } from '../src/services/maios-reasoning/final-report.service.js';
import { maiosReasoningAdapterService } from '../src/services/maios-reasoning/maios-reasoning-adapter.service.js';
import { GINGER_PACK } from '../src/domain/crop-pack/packs/ginger.pack.js';

describe('MAIOS v17 reasoning — knowledge', () => {
  it('loads ginger LR matrix and question bank', () => {
    const pkg = maiosKnowledgeService.load('ginger');
    assert.equal(pkg.cropType, 'ginger');
    assert.ok(pkg.likelihoodRatios.length >= 10);
    assert.ok(pkg.questions.length >= 3);
    assert.ok((pkg.managementRules?.length ?? 0) >= 3);
    assert.ok((pkg.safetyRules?.length ?? 0) >= 2);
  });

  it('loads banana LR matrix v1', () => {
    const pkg = maiosKnowledgeService.load('banana');
    assert.equal(pkg.cropType, 'banana');
    assert.ok(pkg.likelihoodRatios.length >= 8);
    assert.ok(pkg.questions.length >= 2);
    assert.ok(pkg.diseaseLabels.includes('Sigatoka leaf spot'));
  });

  it('loads default fallback knowledge for unknown crops', () => {
    const pkg = maiosKnowledgeService.load('okra');
    assert.equal(pkg.cropType, 'okra');
    assert.ok(pkg.likelihoodRatios.length >= 5);
    assert.ok(pkg.diseaseLabels.includes('Fungal leaf disease'));
  });

  it('loads tomato knowledge v1', () => {
    const pkg = maiosKnowledgeService.load('tomato');
    assert.equal(pkg.cropType, 'tomato');
    assert.ok(pkg.diseaseLabels.includes('Early blight (Alternaria)'));
  });

  it('loads coconut knowledge v1', () => {
    const pkg = maiosKnowledgeService.load('coconut');
    assert.equal(pkg.cropType, 'coconut');
    assert.ok(pkg.diseaseLabels.includes('Bud rot (Phytophthora)'));
  });

  it('loads brinjal knowledge v1', () => {
    const pkg = maiosKnowledgeService.load('brinjal');
    assert.equal(pkg.cropType, 'brinjal');
    assert.ok(pkg.diseaseLabels.includes('Bacterial wilt (Ralstonia)'));
    assert.ok(pkg.diseaseLabels.includes('Fruit and shoot borer'));
  });
});

describe('MAIOS v17 reasoning — developer simulation (ginger blast)', () => {
  it('raises blast posterior with rain + spindle + black dots answers', async () => {
    const contextItems = maiosContextEvidenceService.build({
      cropType: 'ginger',
      symptomsText: 'Spindle shaped brown lesions on leaves after rain',
      contextPack: { heavyRainLikely: true, highHumidityLikely: true },
    });

    let evidence = maiosEvidenceRepositoryService.merge({
      contextItems,
      visionLabel: 'Pyricularia leaf blast',
      visionConfidence: 0.88,
      photos: [{ slot: 'new_leaf_close', status: 'captured', qualityScore: 85 }],
      pack: GINGER_PACK,
      farmerAnswers: [
        { questionText: 'Are black dots visible inside the lesions?', answer: 'yes' },
        { questionText: 'Did symptoms worsen after heavy rain?', answer: 'yes' },
      ],
    });

    const prior = maiosBayesianEngineService.buildPrior(GINGER_KNOWLEDGE_V1);
    let posterior = maiosBayesianEngineService.update(GINGER_KNOWLEDGE_V1, prior, evidence);

    const blast = posterior.find((p) => p.label.includes('blast'));
    assert.ok(blast);
    assert.equal(posterior[0]?.label, 'Pyricularia leaf blast');
    assert.ok(blast!.probability >= 0.35, `expected blast >= 35%, got ${blast!.probability}`);

    const decision = maiosDecisionEngineService.evaluate({
      posterior,
      evidence,
      eqs: 72,
    });
    assert.ok(['LOCK', 'CONTINUE'].includes(decision.action));

    const explanation = maiosExplainabilityEngineService.build({
      pkg: GINGER_KNOWLEDGE_V1,
      posterior,
      evidence,
      llmHypothesisLabels: ['Leaf spot', 'Pyricularia leaf blast'],
    });
    assert.ok(explanation.supporting.length >= 2);
    assert.equal(explanation.diagnosis?.includes('blast'), true);
  });

  it('pipeline attaches reasoning snapshot without replacing hypotheses in shadow mode', async () => {
    const snapshot = await maiosReasoningPipelineService.run({
      cropType: 'ginger',
      pack: GINGER_PACK,
      symptomsText: 'Yellow spindle lesions',
      contextPack: { heavyRainLikely: true, highHumidityLikely: true },
      photos: [{ slot: 'leaf_underside', status: 'captured', qualityScore: 80 }],
      hypotheses: [
        { label: 'Pyricularia leaf blast', probability: 68, source: 'M1' },
        { label: 'Nutrient deficiency', probability: 18, source: 'M1' },
      ],
      eqs: 65,
      maiosRoute: 'agronomist_review',
    });

    assert.ok(snapshot);
    assert.equal(snapshot!.pipelineVersion, '17.0');
    assert.ok(snapshot!.posterior.length >= 1);
    assert.ok(snapshot!.nextEvidence?.label);

    const original = [{ label: 'Pyricularia leaf blast', probability: 68, source: 'M1' as const }];
    const enriched = maiosReasoningPipelineService.enrichHypotheses(original, {
      ...snapshot!,
      shadowMode: true,
    });
    assert.deepEqual(enriched, original);
  });

  it('EVSI ranks black dots question when unanswered', () => {
    const prior = maiosBayesianEngineService.buildPrior(GINGER_KNOWLEDGE_V1);
    const posterior = maiosBayesianEngineService.update(GINGER_KNOWLEDGE_V1, prior, [
      {
        key: 'weather:high_humidity',
        label: 'High humidity',
        source: 'weather',
        reliability: 0.94,
      },
    ]);

    const next = maiosEvsiEngineService.rankQuestions({
      pkg: GINGER_KNOWLEDGE_V1,
      posterior,
      evidence: [],
      answeredQuestionIds: new Set(),
    });

    assert.ok(next);
    assert.equal(next!.kind, 'question');
    assert.ok(next!.expectedInformationGain > 0);
  });
});

describe('MAIOS v17 reasoning — domains 8–10 (management, safety, report)', () => {
  it('builds scientific management plan when diagnosis is locked', () => {
    const plan = maiosScientificManagementService.build({
      pkg: GINGER_KNOWLEDGE_V1,
      diagnosisLabel: 'Pyricularia leaf blast',
      locked: true,
    });
    assert.ok(plan);
    assert.equal(plan!.diagnosisLabel, 'Pyricularia leaf blast');
    assert.ok(plan!.cultural.length >= 1);
    assert.ok(plan!.chemical.some((c) => /strobilurin|triazole/i.test(c.activeIngredientClass)));
  });

  it('returns null management when not locked', () => {
    const plan = maiosScientificManagementService.build({
      pkg: GINGER_KNOWLEDGE_V1,
      diagnosisLabel: 'Pyricularia leaf blast',
      locked: false,
    });
    assert.equal(plan, null);
  });

  it('rejects foliar chemical plan under heavy rain forecast', () => {
    const management = maiosScientificManagementService.build({
      pkg: GINGER_KNOWLEDGE_V1,
      diagnosisLabel: 'Pyricularia leaf blast',
      locked: true,
    });
    const safety = maiosSafetyEngineService.validate({
      pkg: GINGER_KNOWLEDGE_V1,
      management,
      contextPack: { heavyRainLikely: true },
    });
    assert.equal(safety.status, 'REJECT');
    assert.ok(safety.rejectReasons.some((r) => /rain/i.test(r)));
  });

  it('builds final report with farmer and agronomist summaries', () => {
    const prior = maiosBayesianEngineService.buildPrior(GINGER_KNOWLEDGE_V1);
    const posterior = maiosBayesianEngineService.update(GINGER_KNOWLEDGE_V1, prior, [
      {
        key: 'vision:label',
        label: 'Pyricularia leaf blast',
        source: 'vision',
        reliability: 0.9,
      },
    ]);
    const decision = maiosDecisionEngineService.evaluate({
      posterior,
      evidence: [
        {
          key: 'vision:label',
          label: 'Pyricularia leaf blast',
          source: 'vision',
          reliability: 0.9,
        },
      ],
      eqs: 80,
    });
    const explanation = maiosExplainabilityEngineService.build({
      pkg: GINGER_KNOWLEDGE_V1,
      posterior,
      evidence: [],
      llmHypothesisLabels: ['Pyricularia leaf blast'],
    });
    const management = maiosScientificManagementService.build({
      pkg: GINGER_KNOWLEDGE_V1,
      diagnosisLabel: 'Pyricularia leaf blast',
      locked: decision.action === 'LOCK',
    });
    const report = maiosFinalReportService.build({
      decision,
      explanation,
      evidence: [],
      management,
      safety: { status: 'PASS', checks: [], rejectReasons: [] },
      nextStepLabel: 'Are black dots visible inside the lesions?',
    });
    assert.equal(report.version, '17.0');
    assert.ok(report.farmerSummary.length > 20);
    assert.ok(report.agronomistSummary.includes('Decision:'));
    assert.equal(report.nextStep, 'Are black dots visible inside the lesions?');
  });

  it('pipeline attaches finalReport on every run', async () => {
    const snapshot = await maiosReasoningPipelineService.run({
      cropType: 'ginger',
      pack: GINGER_PACK,
      symptomsText: 'Yellow spindle lesions',
      contextPack: { heavyRainLikely: true, highHumidityLikely: true },
      photos: [{ slot: 'leaf_underside', status: 'captured', qualityScore: 80 }],
      hypotheses: [
        { label: 'Pyricularia leaf blast', probability: 68, source: 'M1' },
        { label: 'Nutrient deficiency', probability: 18, source: 'M1' },
      ],
      eqs: 65,
      maiosRoute: 'agronomist_review',
    });

    assert.ok(snapshot?.finalReport);
    assert.equal(snapshot!.finalReport!.version, '17.0');
    assert.equal(snapshot!.decision.action, 'CONTINUE');
    assert.equal(snapshot!.management, null);
    assert.ok(snapshot!.safety);
  });
});

describe('MAIOS v17 reasoning — channel adapters', () => {
  it('visit adapter produces reasoning snapshot with finalReport', async () => {
    const snapshot = await maiosReasoningAdapterService.fromVisit({
      context: {
        farmerId: 'f1',
        blockId: 'b1',
        cropType: 'ginger',
        dap: 45,
        stage: 'vegetative',
        measurements: [{ key: 'spad', value: '42' }],
        soilTestSummary: null,
        weatherSnapshot: {
          diseaseAlerts: ['heavy_rain_likely', 'high_humidity_likely'],
          weatherRiskScore: 72,
        },
        gps: null,
      },
      issueName: 'Leaf spots after rain',
      observation: 'Spindle shaped brown lesions',
      hypotheses: [
        { label: 'Pyricularia leaf blast', confidence: 0.72 },
        { label: 'Nutrient deficiency', confidence: 0.15 },
      ],
      imageSignal: { label: 'Pyricularia leaf blast', confidence: 0.85 },
      analyzePhotoCount: 2,
    });
    assert.ok(snapshot);
    assert.equal(snapshot!.pipelineVersion, '17.0');
    assert.ok(snapshot!.finalReport);
    assert.equal(snapshot!.decision.action, 'CONTINUE');
  });
});
