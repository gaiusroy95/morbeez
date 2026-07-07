import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maiosLearningFacadeService } from '../src/services/maios-reasoning/maios-learning-facade.service.js';
import type { MaiosReasoningSnapshot } from '../src/domain/maios-reasoning/types.js';

describe('MAIOS learning facade — agronomist verify', () => {
  it('recordAgronomistVerifiedOutcome accepts verified label without reasoning LOCK', async () => {
    await assert.doesNotReject(async () => {
      await maiosLearningFacadeService.recordAgronomistVerifiedOutcome({
        farmerId: '00000000-0000-4000-8000-000000000001',
        cropType: 'ginger',
        verifiedIssueLabel: 'Pyricularia leaf blast',
        reviewAction: 'correct_ai',
        outcome: 'improved',
        reasoning: {
          pipelineVersion: '17.0',
          shadowMode: true,
          decision: {
            action: 'CONTINUE',
            topLabel: 'Pyricularia leaf blast',
            topConfidence: 0.62,
            threshold: 0.85,
            evidenceCount: 3,
            reviewRequired: true,
            reason: 'Continue',
          },
        } as MaiosReasoningSnapshot,
      });
    });
  });

  it('skips empty verified label', async () => {
    await assert.doesNotReject(async () => {
      await maiosLearningFacadeService.recordAgronomistVerifiedOutcome({
        farmerId: '00000000-0000-4000-8000-000000000001',
        cropType: 'ginger',
        verifiedIssueLabel: '   ',
        reviewAction: 'approve_ai',
      });
    });
  });
});
