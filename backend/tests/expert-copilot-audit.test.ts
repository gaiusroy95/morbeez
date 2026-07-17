import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { supabase } from '../src/lib/supabase.js';
import { governanceAuditService } from '../src/services/governance/governance-audit.service.js';

describe('Expert Copilot governance audit chain', () => {
  it('appends linked hashes and detects a broken link', async (t) => {
    const rows: Array<Record<string, unknown>> = [];
    const client = supabase as unknown as { from(table: string): unknown };
    t.mock.method(client, 'from', (table: string) => {
      assert.equal(table, 'governance_audit_events');
      const query = {
        select() { return this; },
        order() { return this; },
        limit() { return this; },
        maybeSingle: async () => ({ data: rows.at(-1) ?? null }),
        insert: async (row: Record<string, unknown>) => {
          rows.push(row);
          return { error: null };
        },
        then(
          resolve: (value: { data: Array<Record<string, unknown>> }) => unknown
        ) {
          return Promise.resolve(resolve({ data: [...rows] }));
        },
      };
      return query;
    });

    const first = await governanceAuditService.append({
      actorEmail: 'expert@example.com',
      command: 'case_claimed',
      entityType: 'expert_case',
      entityId: 'case-1',
      payload: { owner: 'expert@example.com' },
    });
    const second = await governanceAuditService.append({
      actorEmail: 'expert@example.com',
      command: 'case_reviewed',
      entityType: 'expert_case',
      entityId: 'case-1',
      beforeHash: 'before',
      afterHash: 'after',
    });

    assert.equal(first.sequence, 1);
    assert.equal(second.sequence, 2);
    assert.equal(rows[1]?.previous_hash, first.eventHash);
    assert.deepEqual(await governanceAuditService.verifyChain(), { ok: true, checked: 2 });

    rows[1] = { ...rows[1], previous_hash: 'tampered' };
    assert.deepEqual(
      await governanceAuditService.verifyChain(),
      { ok: false, checked: 2, brokenAt: 2 }
    );
  });
});
