import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import type { VisitAssistantRecommendationValidationRequest } from '@morbeez/shared/visit-assistant';
import { supabase } from '../src/lib/supabase.js';
import { scoreExpertCaseQueue } from '../src/services/expert-case/expert-case-queue.service.js';
import { recommendationSafetyGateService } from '../src/services/safety/recommendation-safety-gate.service.js';

function mockSafetyInsert(t: TestContext): Array<Record<string, unknown>> {
  const inserted: Array<Record<string, unknown>> = [];
  const client = supabase as unknown as { from(table: string): unknown };
  t.mock.method(client, 'from', (table: string) => {
    assert.equal(table, 'safety_gate_decisions');
    return {
      insert(row: Record<string, unknown>) {
        inserted.push(row);
        return {
          select() {
            return {
              single: async () => ({
                data: { id: `decision-${inserted.length}`, decision: row.decision },
                error: null,
              }),
            };
          },
        };
      },
    };
  });
  return inserted;
}

function structuredValidation(
  material: Record<string, string> | null,
  includeContext = true
): VisitAssistantRecommendationValidationRequest {
  return {
    farmerId: 'farmer-1',
    cropType: includeContext ? 'ginger' : null,
    dap: includeContext ? 45 : null,
    stage: includeContext ? 'vegetative' : null,
    weather: includeContext ? { heavyRainLikely: false, highHeatLikely: false } : undefined,
    recommendationGroups: [{
      localId: 'group-1',
      applicationType: 'foliar_spray',
      applicationDay: 0,
      materials: material ? [{
        localId: 'material-1',
        ...material,
      }] : [],
    }],
  };
}

describe('Expert Copilot safety decisions', () => {
  it('classifies PASS, UNRESOLVED, and REJECT outcomes', async (t) => {
    const inserted = mockSafetyInsert(t);
    const pass = await recommendationSafetyGateService.evaluate({
      aggregateType: 'expert_case',
      aggregateId: 'case-2',
      recommendationRevision: '1',
      validation: { ...structuredValidation(null), recommendationGroups: [] },
      unstructured: {
        recommendationText: 'Apply after irrigation',
        dosage: '5 g/L',
        applicationType: 'soil drench',
      },
    });
    assert.equal(pass.decision, 'PASS');
    assert.equal(pass.allowsApproval, true);
    assert.equal(inserted[0]?.decision, 'PASS');

    const unresolved = await recommendationSafetyGateService.evaluate({
      aggregateType: 'expert_case',
      aggregateId: 'case-1',
      recommendationRevision: '2',
      validation: { ...structuredValidation(null), recommendationGroups: [] },
    });
    assert.equal(unresolved.decision, 'UNRESOLVED');
    assert.equal(unresolved.allowsApproval, false);
    assert.deepEqual(unresolved.blockers, [{
      code: 'empty_recommendation',
      message: 'No recommendation content to evaluate',
    }]);

    const rejected = await recommendationSafetyGateService.evaluate({
      aggregateType: 'expert_case',
      aggregateId: 'case-1',
      recommendationRevision: '3',
      validation: structuredValidation({ technicalName: '' }),
    });
    assert.equal(rejected.decision, 'REJECT');
    assert.equal(rejected.allowsFarmerCommunication, false);
    assert.equal(
      rejected.blockers.some((blocker) =>
        (blocker as { code?: string }).code === 'incomplete_material'
      ),
      true
    );
  });
});

describe('Expert Copilot queue scoring', () => {
  it('prioritizes tier, SLA breach, age, requeues, and weight', () => {
    const now = Date.now();
    const standard = scoreExpertCaseQueue({
      priority_tier: 'standard',
      sla_due_at: new Date(now + 4 * 60 * 60_000).toISOString(),
      queued_at: new Date(now).toISOString(),
      queue_weight: 1,
    });
    const emergency = scoreExpertCaseQueue({
      priority_tier: 'emergency',
      sla_due_at: new Date(now + 4 * 60 * 60_000).toISOString(),
      queued_at: new Date(now).toISOString(),
      queue_weight: 1,
    });
    const starved = scoreExpertCaseQueue({
      priority_tier: 'standard',
      sla_due_at: new Date(now - 1).toISOString(),
      queued_at: new Date(now - 30 * 60 * 60_000).toISOString(),
      requeue_count: 8,
      queue_weight: 2,
    });

    assert.ok(emergency > standard);
    assert.ok(starved > emergency);
  });
});
