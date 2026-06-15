import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfidenceAction } from '../src/domain/ai-training/confidence-routing.js';
import {
  visitAnalyzeRequestSchema,
  visitAiAnswersBodySchema,
} from '../src/domain/ai-training/validators.js';

describe('visit AI analyze request', () => {
  it('accepts analyzePhotos with base64 payloads', () => {
    const parsed = visitAnalyzeRequestSchema.parse({
      farmerId: '11111111-1111-1111-1111-111111111111',
      blockId: '22222222-2222-2222-2222-222222222222',
      issueCategory: 'disease',
      issueName: 'Leaf spot',
      analyzePhotos: [{ dataBase64: 'a'.repeat(120), mimeType: 'image/jpeg' }],
    });
    assert.equal(parsed.analyzePhotos?.length, 1);
  });

  it('rejects empty analyzePhotos base64', () => {
    assert.throws(() =>
      visitAnalyzeRequestSchema.parse({
        farmerId: '11111111-1111-1111-1111-111111111111',
        blockId: '22222222-2222-2222-2222-222222222222',
        issueCategory: 'disease',
        issueName: 'Leaf spot',
        analyzePhotos: [{ dataBase64: 'short' }],
      })
    );
  });
});

describe('visit AI Q&A persistence schema', () => {
  it('accepts yes/no/unknown answers', () => {
    const parsed = visitAiAnswersBodySchema.parse({
      answers: [{ questionId: '33333333-3333-3333-3333-333333333333', answer: 'yes' }],
    });
    assert.equal(parsed.answers[0]?.answer, 'yes');
  });
});

describe('visit AI confidence routing bands', () => {
  it('maps high confidence to auto_send (skip Q&A eligible at ≥90% orchestrator)', () => {
    assert.equal(resolveConfidenceAction(0.96), 'auto_send');
    assert.equal(resolveConfidenceAction(0.9), 'employee_review');
  });

  it('maps low confidence to escalate', () => {
    assert.equal(resolveConfidenceAction(0.65), 'escalate');
  });
});
