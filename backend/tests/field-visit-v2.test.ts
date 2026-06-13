import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { structuredFieldVisitSchema } from '../src/domain/ai-training/validators.js';

describe('structured field visit v2', () => {
  it('accepts a multi-issue visit payload', () => {
    const parsed = structuredFieldVisitSchema.parse({
      farmerId: '11111111-1111-1111-1111-111111111111',
      blockId: '22222222-2222-2222-2222-222222222222',
      blockAssessment: {
        blockHealth: 'good',
        cropPerformance: 'as_expected',
        soilMoisture: 'optimal',
      },
      measurements: [{ key: 'spad', value: '42', unit: '' }],
      issues: [
        {
          category: 'disease',
          issueName: 'Leaf spot',
          severity: 'medium',
          status: 'open',
          observation: 'Lower leaves affected',
        },
        {
          category: 'pest',
          issueName: 'Thrips',
          severity: 'low',
        },
      ],
      followUps: [
        {
          recommendationId: '33333333-3333-3333-3333-333333333333',
          followed: 'yes',
          outcome: 'improved',
        },
      ],
    });

    assert.equal(parsed.issues.length, 2);
    assert.equal(parsed.blockAssessment?.blockHealth, 'good');
  });

  it('rejects visit without issues', () => {
    assert.throws(() =>
      structuredFieldVisitSchema.parse({
        farmerId: '11111111-1111-1111-1111-111111111111',
        blockId: '22222222-2222-2222-2222-222222222222',
        issues: [],
      })
    );
  });
});
