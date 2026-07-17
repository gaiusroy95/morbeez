import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExpertCaseQueue } from '@morbeez/shared';
import { canCommitExpertDraft, enabledExpertQueue } from '../lib/expert-copilot';

function queue(enabled: boolean): ExpertCaseQueue {
  return {
    enabled,
    buckets: { my_work: [], available: [], at_risk: [], intervention: [] },
  };
}

describe('Expert Copilot progressive rollout', () => {
  it('keeps legacy tasks unless the expert endpoint explicitly enables the queue', () => {
    assert.equal(enabledExpertQueue(queue(false)), null);
    assert.equal(enabledExpertQueue(queue(true))?.enabled, true);
  });

  it('requires a passing safety gate and explicit confirmation before commit', () => {
    assert.equal(canCommitExpertDraft('PASS', false), false);
    assert.equal(canCommitExpertDraft('UNRESOLVED', true), false);
    assert.equal(canCommitExpertDraft('REJECT', true), false);
    assert.equal(canCommitExpertDraft('PASS', true), true);
  });
});
