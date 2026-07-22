import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectVisitCopilotIntent,
  looksLikeFarmerEvidenceMessage,
} from '@morbeez/shared/visit-copilot';

describe('detectVisitCopilotIntent', () => {
  it('detects confirm send questions', () => {
    assert.deepEqual(detectVisitCopilotIntent('Yes', 'awaiting_send_questions'), {
      kind: 'confirm_send_questions',
    });
  });

  it('detects approve', () => {
    assert.deepEqual(detectVisitCopilotIntent('Approve', 'awaiting_approval'), { kind: 'approve' });
  });

  it('detects clinical instruction paragraph', () => {
    const text =
      'I think this may be rhizome rot. Ask the farmer to cut a diseased ginger rhizome and upload a cross-section.';
    assert.equal(detectVisitCopilotIntent(text, 'idle').kind, 'clinical_instruction');
  });

  it('detects farmer evidence replies', () => {
    const text =
      'Cross-section uploaded. Brown discoloration present. No bacterial ooze. About 5% of plants affected.';
    assert.equal(detectVisitCopilotIntent(text, 'awaiting_farmer_evidence').kind, 'farmer_evidence');
    assert.equal(looksLikeFarmerEvidenceMessage(text), true);
  });
});
