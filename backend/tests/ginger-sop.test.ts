import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gingerSopEvidenceService } from '../src/services/ginger-sop/ginger-sop-evidence.service.js';
import { gingerSopRiskTagsService } from '../src/services/ginger-sop/ginger-sop-risk-tags.service.js';
import { gingerSopConfidenceService } from '../src/services/ginger-sop/ginger-sop-confidence.service.js';
import { gingerSopGatesService } from '../src/services/ginger-sop/ginger-sop-gates.service.js';
import { gingerSopCanopyAuditService } from '../src/services/ginger-sop/ginger-sop-canopy-audit.service.js';
import { GINGER_MODULE_WEIGHTS } from '../src/domain/ginger-sop/photo-slots.js';

describe('ginger SOP v3 evidence', () => {
  it('assigns whatsapp photos to priority slots', () => {
    const photos = gingerSopEvidenceService.assignPhotosToSlots({
      photoCount: 3,
      channel: 'whatsapp',
    });
    const captured = photos.filter((p) => p.status === 'captured');
    assert.equal(captured.length, 3);
    assert.equal(captured[0]!.slot, 'new_leaf_close');
    assert.equal(captured[1]!.slot, 'old_leaf_close');
    assert.equal(captured[2]!.slot, 'leaf_underside');
    const pct = gingerSopEvidenceService.completenessPct(photos);
    assert.ok(pct > 10 && pct < 50);
  });

  it('maps evidence tier from soil and root', () => {
    assert.equal(gingerSopEvidenceService.evidenceTier(55, true, true, false), 'T4');
    assert.equal(gingerSopEvidenceService.evidenceTier(5, false, false, false), 'T0');
    assert.equal(gingerSopEvidenceService.evidenceTier(80, true, true, true), 'T5');
  });
});

describe('ginger SOP v3 canopy audit', () => {
  it('computes DAP canopy gap', () => {
    const audit = gingerSopCanopyAuditService.build({
      canopyClosurePct: 35,
      dap: 60,
      bedFloorVisibilityScore: 3,
      weedPressureScore: 4,
    });
    assert.equal(audit.dapExpectedClosurePct, 60);
    assert.equal(audit.canopyGapPct, 25);
    assert.equal(audit.auditComplete, true);
    const score = gingerSopCanopyAuditService.scoreForModule(audit);
    assert.ok(score >= 50 && score <= 92);
  });
});

describe('ginger SOP v3 risk tags', () => {
  it('flags high pH and waterlog risks', () => {
    const tags = gingerSopRiskTagsService.compute({
      soilPh: 8.1,
      heavyRainLikely: true,
      drainageRisk: 'high',
      probableIssue: 'yellow leaves',
    });
    assert.ok(tags.includes('HIGH_PH_RISK'));
    assert.ok(tags.includes('WATERLOG_RISK'));
  });

  it('flags irrigation water EC risk', () => {
    const tags = gingerSopRiskTagsService.compute({
      irrigationEc: 3.1,
      irrigationPh: 8.2,
    });
    assert.ok(tags.includes('HIGH_EC_RISK'));
    assert.ok(tags.includes('HIGH_PH_RISK'));
  });
});

describe('ginger SOP v3 confidence', () => {
  it('fuses module scores with model confidence', () => {
    const modules = gingerSopConfidenceService.buildModuleScores({
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
    assert.equal(modules.length, 9);
    const fused = gingerSopConfidenceService.fusedConfidence(modules, 0.82, null);
    assert.ok(fused >= 0.4 && fused <= 0.98);
  });

  it('module weights sum to 100', () => {
    const sum = Object.values(GINGER_MODULE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(sum, 100);
  });
});

describe('ginger SOP v3 gates', () => {
  it('routes low evidence whatsapp to collect_evidence', () => {
    const { route } = gingerSopGatesService.evaluate({
      identityComplete: true,
      evidenceCompleteness: 8,
      evidenceTier: 'T0',
      triageLevel: 'L1',
      fusedConfidence: 0.62,
      hasSoilForNutrientRec: false,
      needsNutrientAdvice: false,
      channel: 'whatsapp',
    });
    assert.equal(route, 'collect_evidence');
  });

  it('routes L4 triage to emergency_callback', () => {
    const { route } = gingerSopGatesService.evaluate({
      identityComplete: true,
      evidenceCompleteness: 40,
      evidenceTier: 'T2',
      triageLevel: 'L4',
      fusedConfidence: 0.48,
      hasSoilForNutrientRec: true,
      needsNutrientAdvice: false,
      channel: 'whatsapp',
    });
    assert.equal(route, 'emergency_callback');
  });
});
