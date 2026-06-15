import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfidenceAction } from '../src/domain/ai-training/confidence-routing.js';
import {
  visitAnalyzeRequestSchema,
  visitAiAnswersBodySchema,
  visitAiRejectBodySchema,
} from '../src/domain/ai-training/validators.js';
import {
  validateRejectReasonFlow,
  isRejectReviewIncomplete,
} from '../../packages/shared/src/visit-wizard/reject-flow.js';

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

/*
 * Manual E2E checklist (mobile + web visit wizard Review step):
 * 1. Wrong diagnosis — correct diagnosis saved, new AI rec generated, wizard stays on Review.
 * 2. Need more evidence — WhatsApp sent, case waiting_farmer_response, no farmer rec on submit.
 * 3. Rec not suitable — diagnosis unchanged, edited rec saved, training event recorded.
 * 4. Custom rec — product/dose/method saved, farmer rec sent on submit.
 */

describe('visit AI reject recommendation schema', () => {
  it('requires correctedDiagnosis for wrong_diagnosis', () => {
    assert.throws(() =>
      visitAiRejectBodySchema.parse({ reason: 'wrong_diagnosis' })
    );
    const parsed = visitAiRejectBodySchema.parse({
      reason: 'wrong_diagnosis',
      correctedDiagnosis: 'Bacterial leaf blight',
    });
    assert.equal(parsed.reason, 'wrong_diagnosis');
  });

  it('requires evidenceRequest for need_more_evidence', () => {
    assert.throws(() =>
      visitAiRejectBodySchema.parse({ reason: 'need_more_evidence' })
    );
    const parsed = visitAiRejectBodySchema.parse({
      reason: 'need_more_evidence',
      evidenceRequest: {
        photoTypes: ['whole_plant'],
        questions: [{ key: 'fungicide_applied', text: 'Applied fungicide?', answer: 'no' }],
      },
    });
    assert.equal(parsed.evidenceRequest?.photoTypes[0], 'whole_plant');
  });

  it('requires rejectNote and editedRecommendation for recommendation_not_suitable', () => {
    assert.throws(() =>
      visitAiRejectBodySchema.parse({
        reason: 'recommendation_not_suitable',
        rejectNote: 'Too early',
      })
    );
  });

  it('requires customRecommendation for custom_recommendation', () => {
    const parsed = visitAiRejectBodySchema.parse({
      reason: 'custom_recommendation',
      customRecommendation: {
        product: 'Copper oxychloride',
        dose: '2 g/L',
        method: 'Foliar spray',
      },
    });
    assert.equal(parsed.customRecommendation?.product, 'Copper oxychloride');
  });
});

describe('visit AI reject flow validation helpers', () => {
  it('marks incomplete reject review until flow completes', () => {
    assert.equal(
      isRejectReviewIncomplete({ action: 'reject_recommendation', rejectReason: 'wrong_diagnosis' }),
      true
    );
    assert.equal(
      isRejectReviewIncomplete({
        action: 'reject_recommendation',
        rejectReason: 'wrong_diagnosis',
        rejectFlowComplete: true,
      }),
      false
    );
  });

  it('validates branch-specific payloads', () => {
    assert.equal(
      validateRejectReasonFlow('wrong_diagnosis', { correctedDiagnosis: '' }),
      'Enter the correct diagnosis.'
    );
    assert.equal(
      validateRejectReasonFlow('wrong_diagnosis', { correctedDiagnosis: 'Correct issue' }),
      null
    );
  });
});
