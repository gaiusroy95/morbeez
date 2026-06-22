import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildInsufficientEvidenceEnvelope,
  isDiagnosisInferenceAvailable,
  mapImageSourceToDiagnosisSource,
  wrapHypothesesAsEnvelope,
} from '../src/services/diagnosis/diagnosis-integrity.util.js';
import { computeEvidenceSignals } from '../src/services/core/visit-ai-prompt-context.service.js';

describe('diagnosis integrity', () => {
  it('insufficient envelope has no hypotheses', () => {
    const env = buildInsufficientEvidenceEnvelope('no API key');
    assert.equal(env.source, 'insufficient_evidence');
    assert.equal(env.hypotheses.length, 0);
    assert.equal(env.escalationRequired, true);
  });

  it('wrapHypothesesAsEnvelope rejects empty hypotheses', () => {
    const env = wrapHypothesesAsEnvelope({ hypotheses: [], source: 'model' });
    assert.equal(env.source, 'insufficient_evidence');
  });

  it('wrapHypothesesAsEnvelope accepts model hypotheses', () => {
    const env = wrapHypothesesAsEnvelope({
      hypotheses: [{ label: 'Thrips', confidence: 0.8, rationale: 'vision' }],
      source: 'model',
    });
    assert.equal(env.source, 'model');
    assert.equal(env.hypotheses[0]?.label, 'Thrips');
  });

  it('maps vision sources correctly', () => {
    assert.equal(mapImageSourceToDiagnosisSource('plant_id'), 'vision');
    assert.equal(mapImageSourceToDiagnosisSource('vision'), 'vision');
  });

  it('evidence signals are context-only (no boost field)', () => {
    const signals = computeEvidenceSignals(
      {
        farmerId: 'f1',
        blockId: 'b1',
        cropType: 'ginger',
        dap: 90,
        stage: 'vegetative',
        measurements: [{ key: 'disease_incidence_pct', value: '40' }],
        soilTestSummary: { metrics: { nitrogen: 150 } },
        weatherSnapshot: null,
        blockAssessment: null,
      },
      'disease',
      { label: 'Yellowing', confidence: 0.7, source: 'vision', photoCount: 2 }
    );
    assert.ok(signals.length > 0);
    for (const s of signals) {
      assert.ok('signal' in s);
      assert.ok(!('boost' in s) || (s as { boost?: number }).boost === undefined);
    }
  });

  it('isDiagnosisInferenceAvailable reflects env', () => {
    assert.equal(typeof isDiagnosisInferenceAvailable(), 'boolean');
  });

  it('crop-doctor module exposes unified orchestrator for WhatsApp convergence', async () => {
    const { diagnosisOrchestratorService } = await import('../src/services/ai/crop-doctor.service.js');
    assert.equal(typeof diagnosisOrchestratorService.analyzeVisit, 'function');
  });
});
