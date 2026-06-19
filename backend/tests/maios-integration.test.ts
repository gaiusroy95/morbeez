import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { failureAnalysisService } from '../src/services/case/failure-analysis.service.js';
import { economicGateService } from '../src/services/case/economic-gate.service.js';
import { multiModelFusionService } from '../src/services/case/multi-model-fusion.service.js';
import { executionVerificationService } from '../src/services/case/execution-verification.service.js';
import { GINGER_PACK } from '../src/domain/crop-pack/packs/ginger.pack.js';
import { moduleFusionService } from '../src/services/case/module-fusion.service.js';

describe('MAIOS execution loop services', () => {
  it('classifies worse outcome with high confidence as product_failure when applied', () => {
    const type = failureAnalysisService.classify({
      outcomeStatus: 'worse',
      agronomistCorrected: false,
      applicationLogged: true,
      fusedConfidence: 0.82,
    });
    assert.equal(type, 'product_failure');
  });

  it('classifies worse without application as farmer_failure', () => {
    const type = failureAnalysisService.classify({
      outcomeStatus: 'worse',
      applicationLogged: false,
    });
    assert.equal(type, 'farmer_failure');
  });

  it('economic gate blocks negative ROI', () => {
    const gate = economicGateService.assess({
      treatmentCostInr: 1000,
      expectedBenefitInr: 500,
    });
    assert.equal(gate.proceed, false);
  });

  it('execution verification returns score structure', async () => {
    const result = await executionVerificationService.verify({
      farmerId: '00000000-0000-0000-0000-000000000000',
      sessionId: '00000000-0000-0000-0000-000000000001',
    });
    assert.ok(typeof result.score === 'number');
    assert.ok(Array.isArray(result.checks));
  });
});

describe('MAIOS multi-model fusion v1', () => {
  it('merges regional and KG candidates into hypotheses', async () => {
    const modules = moduleFusionService.buildModuleScores({
      pack: GINGER_PACK,
      evidenceCompleteness: 50,
      hasBlockId: true,
      hasSoilReport: true,
      hasWaterData: true,
      hasInputHistory: false,
      hasRootPhoto: true,
      hasFieldMetrics: true,
      hasCanopyAudit: true,
      modelConfidence: 0.75,
    });

    const result = await multiModelFusionService.enrichHypotheses(
      [{ label: 'Thrips', probability: 70, source: 'M1' }],
      {
        modelConfidence: 0.75,
        hasPlantId: true,
        moduleScores: modules,
        regionalPriors: [{ issueLabel: 'Phyllosticta leaf spot', caseCount: 5 }],
        kgCandidates: [{ label: 'Nutrient deficiency', relation: 'suggests_issue', weight: 0.8 }],
      }
    );

    assert.ok(result.hypotheses.length >= 2);
    assert.ok(result.modelAgreement >= 0);
    assert.ok(result.hypotheses.some((h) => h.source === 'M5' || h.source === 'M3'));
  });
});
