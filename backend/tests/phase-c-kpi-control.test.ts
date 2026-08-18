import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  isMutableStatus,
  monthKey,
  previousMonth,
  shouldActivateNow,
} from '../src/domain/remuneration/rule-workflow.js';
import {
  DEFAULT_PARTNER_KPI_WEIGHTS,
  parameterScore,
  scoreWeightedKpi,
  validateWeights,
} from '../src/domain/remuneration/weighted-kpi.js';
import {
  DEFAULT_QUALIFIED_CASE_RULE,
  evaluateQualifiedCase,
  present,
} from '../src/domain/remuneration/qualified-case.js';
import {
  diagnosisAccuracyPct,
  diagnosisQaSampleSize,
  pickSample,
} from '../src/domain/remuneration/diagnosis-qa.js';

describe('rule workflow', () => {
  it('only allows DRAFT → SUBMITTED → APPROVED → SCHEDULED/ACTIVE → EXPIRED', () => {
    assert.equal(canTransition('draft', 'submitted'), true);
    assert.equal(canTransition('submitted', 'approved'), true);
    assert.equal(canTransition('approved', 'scheduled'), true);
    assert.equal(canTransition('approved', 'active'), true);
    assert.equal(canTransition('scheduled', 'active'), true);
    assert.equal(canTransition('active', 'expired'), true);
    assert.equal(canTransition('active', 'draft'), false);
    assert.equal(canTransition('expired', 'active'), false);
    assert.equal(isMutableStatus('draft'), true);
    assert.equal(isMutableStatus('active'), false);
  });

  it('activates when effective_from is not in the future', () => {
    assert.equal(shouldActivateNow('2026-08-01', new Date('2026-08-18T12:00:00Z')), true);
    assert.equal(shouldActivateNow('2026-09-01', new Date('2026-08-18T12:00:00Z')), false);
  });

  it('names the previous calendar month', () => {
    assert.equal(previousMonth(new Date('2026-09-01T00:00:00Z')), '2026-08');
    assert.equal(monthKey(new Date('2026-08-18T00:00:00Z')), '2026-08');
  });
});

describe('weighted KPI', () => {
  it('uses the spec 8-parameter partner weights that sum to 100', () => {
    validateWeights(DEFAULT_PARTNER_KPI_WEIGHTS);
    assert.equal(
      DEFAULT_PARTNER_KPI_WEIGHTS.reduce((s, p) => s + p.weightPct, 0),
      100
    );
  });

  it('scores each parameter against its target then applies weights', () => {
    const { total, lines } = scoreWeightedKpi(DEFAULT_PARTNER_KPI_WEIGHTS, {
      eligible_sales: 100_000,
      farmer_retention: 80,
      field_service: 80,
      territory: 80,
      collections: 90,
      advocacy: 50,
      lead_response: 80,
      reporting: 80,
    });
    assert.equal(total, 100);
    assert.equal(lines[0].score, 100);
  });

  it('does not let a later target rewrite a frozen actual/target ratio', () => {
    assert.equal(parameterScore(80, 80), 100);
    assert.equal(parameterScore(80, 100), 80);
  });
});

describe('qualified case', () => {
  const PASS = {
    farmerVerified: true,
    cropRecorded: true,
    cropStageRecorded: true,
    problemRecorded: true,
    diagnosisRecorded: true,
    recommendationRecorded: true,
    evidenceComplete: true,
  };

  it('does not treat a bare case record as qualified', () => {
    const empty = evaluateQualifiedCase({
      farmerVerified: false,
      cropRecorded: false,
      cropStageRecorded: false,
      problemRecorded: false,
      diagnosisRecorded: false,
      recommendationRecorded: false,
      evidenceComplete: false,
    });
    assert.equal(empty.qualified, false);
    assert.equal(empty.reasons.length, 7);
  });

  it('requires every gate from the rule version', () => {
    const missingDiagnosis = evaluateQualifiedCase({ ...PASS, diagnosisRecorded: false });
    assert.equal(missingDiagnosis.qualified, false);
    assert.ok(missingDiagnosis.reasons.includes('diagnosis_missing'));
    assert.equal(evaluateQualifiedCase(PASS).qualified, true);
  });

  it('can relax a gate only via the rule version', () => {
    const r = evaluateQualifiedCase(
      { ...PASS, evidenceComplete: false },
      { ...DEFAULT_QUALIFIED_CASE_RULE, requireEvidence: false }
    );
    assert.equal(r.qualified, true);
  });

  it('treats blank strings as missing', () => {
    assert.equal(present('  '), false);
    assert.equal(present('leaf rust'), true);
  });
});

describe('diagnosis QA sample', () => {
  it('is MIN(10% of qualified cases, 30)', () => {
    assert.equal(diagnosisQaSampleSize(0), 0);
    assert.equal(diagnosisQaSampleSize(10), 1);
    assert.equal(diagnosisQaSampleSize(200), 20);
    assert.equal(diagnosisQaSampleSize(400), 30);
    assert.equal(diagnosisQaSampleSize(1000), 30);
  });

  it('reads rate and cap from the rule version', () => {
    assert.equal(diagnosisQaSampleSize(200, { sampleRatePct: 20, sampleCap: 25 }), 25);
    assert.equal(diagnosisQaSampleSize(40, { sampleRatePct: 20, sampleCap: 25 }), 8);
  });

  it('computes accuracy from audited rows only', () => {
    assert.equal(diagnosisAccuracyPct(9, 1), 90);
    assert.equal(diagnosisAccuracyPct(0, 0), 0);
  });

  it('draws a stable sample for the same month seed', () => {
    const ids = Array.from({ length: 40 }, (_, i) => i);
    const a = pickSample(ids, 4, 'diagnosis-qa:2026-08');
    const b = pickSample(ids, 4, 'diagnosis-qa:2026-08');
    assert.deepEqual(a, b);
    assert.equal(a.length, 4);
  });
});
