import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import { env } from '../src/config/env.js';
import { supabase } from '../src/lib/supabase.js';
import {
  buildExpertCaseCommitRequestHash,
  expertCaseCommitService,
  type CaseReviewCommitInput,
} from '../src/services/expert-case/expert-case-commit.service.js';
import { expertCaseLifecycleService } from '../src/services/expert-case/expert-case-lifecycle.service.js';
import { reviewerRiskService } from '../src/services/governance/reviewer-risk.service.js';
import { learningGovernanceService } from '../src/services/learning/learning-governance.service.js';

const baseCommit: CaseReviewCommitInput = {
  caseId: 'case-1',
  idempotencyKey: 'commit-1',
  actorEmail: 'expert@example.com',
  expectedRevision: 4,
  draft: {
    diagnosis: 'Rhizome rot',
    recommendationText: 'Improve drainage',
    dosage: 'N/A',
  },
};

function setEnv(t: TestContext, values: Record<string, boolean>): void {
  const mutableEnv = env as unknown as Record<string, unknown>;
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, mutableEnv[key]])
  );
  Object.assign(mutableEnv, values);
  t.after(() => Object.assign(mutableEnv, previous));
}

function mockExistingCommand(t: TestContext, existing: Record<string, unknown>): void {
  const client = supabase as unknown as { from(table: string): unknown };
  t.mock.method(client, 'from', (table: string) => {
    assert.equal(table, 'operation_commands');
    return {
      select() { return this; },
      eq() { return this; },
      maybeSingle: async () => ({ data: existing }),
    };
  });
}

describe('Expert Copilot commit concurrency and idempotency', () => {
  it('hashes semantic commit payload deterministically and includes revision', () => {
    const first = buildExpertCaseCommitRequestHash(baseCommit);
    assert.equal(first, buildExpertCaseCommitRequestHash({ ...baseCommit }));
    assert.notEqual(
      first,
      buildExpertCaseCommitRequestHash({ ...baseCommit, expectedRevision: 5 })
    );
    assert.equal(
      first,
      buildExpertCaseCommitRequestHash({ ...baseCommit, closeCase: false })
    );
  });

  it('returns the recorded response for a succeeded idempotent replay', async (t) => {
    setEnv(t, { ENABLE_EXPERT_CASES: true, ENABLE_EXPERT_COMMIT_RPCS: true });
    const response = {
      commandId: 'command-1',
      caseId: 'case-1',
      revision: 5,
      closed: false,
      communicationIntentId: null,
      knowledgeCandidateId: null,
    };
    mockExistingCommand(t, {
      id: 'command-1',
      request_hash: buildExpertCaseCommitRequestHash(baseCommit),
      status: 'succeeded',
      response_json: response,
    });
    let lifecycleReads = 0;
    t.mock.method(expertCaseLifecycleService, 'getById', async () => {
      lifecycleReads += 1;
      return null;
    });

    assert.deepEqual(await expertCaseCommitService.commitCaseReview(baseCommit), response);
    assert.equal(lifecycleReads, 0);
  });

  it('rejects reuse of an idempotency key with a different payload', async (t) => {
    setEnv(t, { ENABLE_EXPERT_CASES: true, ENABLE_EXPERT_COMMIT_RPCS: true });
    mockExistingCommand(t, {
      id: 'command-1',
      request_hash: 'different-payload-hash',
      status: 'succeeded',
      response_json: {},
    });

    await assert.rejects(
      expertCaseCommitService.commitCaseReview(baseCommit),
      /idempotency_key_payload_mismatch/
    );
  });

  it('rejects a stale expected revision before appending a revision', async (t) => {
    setEnv(t, {
      ENABLE_EXPERT_CASES: true,
      ENABLE_EXPERT_COMMIT_RPCS: true,
      ENABLE_EXPERT_CASE_VERSION_LOCK: true,
      ENABLE_EXPERT_CASE_OWNERSHIP: false,
    });
    const client = supabase as unknown as { from(table: string): unknown };
    t.mock.method(client, 'from', (table: string) => {
      assert.equal(table, 'operation_commands');
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: null }),
        insert: async () => ({ error: null }),
        update() { return this; },
      };
    });
    t.mock.method(expertCaseLifecycleService, 'getById', async () => ({
      id: 'case-1',
      review_flag: 'open',
      current_revision: 5,
    }));
    let appendCalls = 0;
    t.mock.method(expertCaseLifecycleService, 'appendRevision', async () => {
      appendCalls += 1;
      return 6;
    });

    await assert.rejects(
      expertCaseCommitService.commitCaseReview(baseCommit),
      /stale_base_revision/
    );
    assert.equal(appendCalls, 0);
  });
});

describe('Expert Copilot independent review', () => {
  it('rejects self-review and records a high-severity risk signal', async (t) => {
    t.mock.method(reviewerRiskService, 'assertCanApprove', async () => undefined);
    let signal: Record<string, unknown> | undefined;
    t.mock.method(reviewerRiskService, 'recordSignal', async (input) => {
      signal = input;
    });
    const client = supabase as unknown as { from(table: string): unknown };
    t.mock.method(client, 'from', (table: string) => {
      assert.equal(table, 'knowledge_candidates');
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: { id: 'candidate-1', proposed_by: 'author@example.com' },
        }),
      };
    });

    await assert.rejects(
      learningGovernanceService.reviewCandidate({
        candidateId: 'candidate-1',
        reviewerEmail: ' Author@Example.com ',
        verdict: 'approve',
      }),
      /Proposer cannot review their own candidate/
    );
    assert.deepEqual(signal, {
      reviewerEmail: 'author@example.com',
      signalType: 'self_review',
      severity: 'high',
      detail: { candidateId: 'candidate-1' },
    });
  });
});
