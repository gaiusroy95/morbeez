import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { VisitAssistantRecommendationValidationRequest } from '@morbeez/shared/visit-assistant';
import { validateVisitAssistantRecommendations } from '../src/services/agronomist/visit-assistant-recommendation-safety.service.js';

function request(
  overrides: Partial<VisitAssistantRecommendationValidationRequest> = {}
): VisitAssistantRecommendationValidationRequest {
  return {
    farmerId: '00000000-0000-4000-8000-000000000001',
    blockId: '00000000-0000-4000-8000-000000000002',
    cropType: 'ginger',
    dap: 45,
    stage: 'vegetative',
    weather: { heavyRainLikely: false, highHeatLikely: false },
    recommendationGroups: [{
      localId: 'group-1',
      applicationType: 'foliar_spray',
      applicationDay: 0,
      materials: [{
        localId: 'material-1',
        technicalName: 'Mancozeb',
        category: 'fungicide',
        doseQuantity: '500',
        doseUnit: 'ML',
        doseBasis: 'per_200_ltr_water',
        applicationMode: 'foliar',
      }],
    }],
    ...overrides,
  };
}

const compatible = {
  checkMaterials: async () => ({
    pairs: [],
    hasIncompatiblePair: false,
    hasUnknownPair: false,
  }),
};

describe('visit assistant recommendation safety', () => {
  it('accepts complete materials without claiming approval', async () => {
    const result = await validateVisitAssistantRecommendations(request(), compatible);

    assert.equal(result.ok, true);
    assert.deepEqual(result.blockers, []);
    assert.equal(result.safetyReport?.status, 'PASS');
    assert.equal('approved' in result, false);
  });

  it('blocks every incomplete material field', async () => {
    const input = request();
    input.recommendationGroups[0]!.materials[0] = {
      localId: 'material-1',
      technicalName: ' ',
    };

    const result = await validateVisitAssistantRecommendations(input, compatible);

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.blockers.map((item) => item.field).sort(),
      ['applicationMode', 'doseBasis', 'doseQuantity', 'doseUnit', 'technicalName']
    );
    assert.equal(result.unresolvedFields.length, 5);
  });

  it('blocks incomplete dose and unit without approving or submitting', async () => {
    const input = request();
    input.recommendationGroups[0]!.materials[0]!.doseQuantity = ' ';
    delete input.recommendationGroups[0]!.materials[0]!.doseUnit;

    const result = await validateVisitAssistantRecommendations(input, compatible);

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.blockers.map((item) => item.field).sort(),
      ['doseQuantity', 'doseUnit']
    );
    assert.equal(result.unresolvedFields.length, 2);
    assert.equal('approved' in result, false);
    assert.equal('submitted' in result, false);
  });

  it('blocks incompatible pairs within a recommendation group', async () => {
    const result = await validateVisitAssistantRecommendations(request(), {
      checkMaterials: async () => ({
        pairs: [{
          productA: 'Calcium nitrate',
          productB: 'MKP',
          found: true,
          compatible: false,
        }],
        hasIncompatiblePair: true,
        hasUnknownPair: false,
      }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.blockers.some((item) => item.code === 'incompatible_materials'), true);
    assert.equal(result.compatibilityReport.groups[0]?.groupRef, 'group-1');
  });

  it('returns warnings and unresolved fields when context is unavailable', async () => {
    const result = await validateVisitAssistantRecommendations(
      request({ dap: null, stage: null, weather: undefined }),
      compatible
    );

    assert.equal(result.ok, true);
    assert.equal(result.safetyReport?.status, 'UNRESOLVED');
    assert.equal(result.warnings.some((item) => item.code === 'missing_dap'), true);
    assert.equal(result.warnings.some((item) => item.code === 'missing_weather'), true);
    assert.equal(result.unresolvedFields.some((item) => item.code === 'missing_stage'), true);
  });
});
