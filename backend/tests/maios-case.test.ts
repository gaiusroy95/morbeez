import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceQualityService } from '../src/services/case/evidence-quality.service.js';
import { caseGatesService } from '../src/services/case/case-gates.service.js';
import { moduleFusionService } from '../src/services/case/module-fusion.service.js';
import { cropPackLoaderService } from '../src/services/crop-pack/crop-pack-loader.service.js';
import { GINGER_PACK } from '../src/domain/crop-pack/packs/ginger.pack.js';
import { DEFAULT_PACK } from '../src/domain/crop-pack/packs/default.pack.js';
import { gingerSopEvidenceService } from '../src/services/ginger-sop/ginger-sop-evidence.service.js';
import { gingerSopGatesService } from '../src/services/ginger-sop/ginger-sop-gates.service.js';

describe('MAIOS v12 crop packs', () => {
  it('loads ginger pack from builtin', async () => {
    const pack = await cropPackLoaderService.load('ginger');
    assert.equal(pack.cropType, 'ginger');
    assert.ok(pack.photoSlots.length >= 8);
    assert.deepEqual(pack.recoveryDays, [3, 7, 14]);
  });

  it('falls back to default pack for unknown crop', async () => {
    const pack = await cropPackLoaderService.load('unknown_crop_xyz');
    assert.equal(pack.cropType, '_default');
  });

  it('module weights sum near 100 for ginger and default', () => {
    const gSum = Object.values(GINGER_PACK.moduleWeights ?? {}).reduce((a, b) => a + b, 0);
    const dSum = Object.values(DEFAULT_PACK.moduleWeights ?? {}).reduce((a, b) => a + b, 0);
    assert.equal(gSum, 100);
    assert.ok(dSum >= 90);
  });
});

describe('MAIOS v12 evidence quality', () => {
  it('assigns photos using pack slot order', () => {
    const photos = evidenceQualityService.assignPhotosToSlots({
      pack: GINGER_PACK,
      photoCount: 2,
      channel: 'whatsapp',
    });
    const captured = photos.filter((p) => p.status === 'captured');
    assert.equal(captured.length, 2);
    assert.equal(captured[0]!.slot, 'new_leaf_close');
  });

  it('computes EQS from tier and completeness', () => {
    const eqs = evidenceQualityService.computeEqs({
      completenessPct: 40,
      tier: 'T2',
      hasSoil: true,
      hasRootPhoto: false,
      hasFieldMetrics: false,
      hasWaterData: false,
      hasLabReport: false,
    });
    assert.ok(eqs >= 30 && eqs <= 80);
  });

  it('ginger legacy evidence still works', () => {
    const photos = gingerSopEvidenceService.assignPhotosToSlots({
      photoCount: 3,
      channel: 'whatsapp',
    });
    assert.equal(photos.filter((p) => p.status === 'captured').length, 3);
  });
});

describe('MAIOS v12 gates', () => {
  it('blocks auto-recommend when EQS below 50', () => {
    const { route } = caseGatesService.evaluate({
      identityComplete: true,
      evidenceCompleteness: 10,
      eqs: 35,
      evidenceTier: 'T0',
      triageLevel: 'L1',
      fusedConfidence: 0.65,
      hasSoilForNutrientRec: false,
      needsNutrientAdvice: false,
      channel: 'whatsapp',
    });
    assert.equal(route, 'collect_evidence');
  });

  it('routes L4 to emergency', () => {
    const { route } = caseGatesService.evaluate({
      identityComplete: true,
      evidenceCompleteness: 40,
      eqs: 55,
      evidenceTier: 'T2',
      triageLevel: 'L4',
      fusedConfidence: 0.48,
      hasSoilForNutrientRec: true,
      needsNutrientAdvice: false,
      channel: 'whatsapp',
    });
    assert.equal(route, 'emergency_callback');
  });

  it('includes G5_recovery gate', () => {
    const { gates } = caseGatesService.evaluate({
      identityComplete: true,
      evidenceCompleteness: 50,
      eqs: 72,
      evidenceTier: 'T3',
      triageLevel: 'L1',
      fusedConfidence: 0.8,
      hasSoilForNutrientRec: true,
      needsNutrientAdvice: false,
      channel: 'whatsapp',
      recoveryScheduled: true,
    });
    assert.ok(gates.some((g) => g.gate === 'G5_recovery' && g.passed));
  });
});

describe('MAIOS v12 module fusion', () => {
  it('builds module scores from pack weights', () => {
    const modules = moduleFusionService.buildModuleScores({
      pack: GINGER_PACK,
      evidenceCompleteness: 35,
      hasBlockId: true,
      hasSoilReport: true,
      hasWaterData: false,
      hasInputHistory: true,
      hasRootPhoto: false,
      hasFieldMetrics: false,
      hasCanopyAudit: false,
      modelConfidence: 0.82,
    });
    assert.ok(modules.length >= 9);
    const fused = moduleFusionService.fusedConfidence(modules, 0.82, null);
    assert.ok(fused >= 0.4 && fused <= 0.98);
  });
});
