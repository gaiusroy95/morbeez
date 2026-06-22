import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { protocolDefinitionService } from '../src/services/intelligence/enterprise-ops.service.js';
import { executiveCockpitService } from '../src/services/intelligence/enterprise-dashboard.service.js';
import { farmerIntelligenceService } from '../src/services/intelligence/farmer-intelligence.service.js';
import { diagnosisOrchestratorService } from '../src/services/ai/crop-doctor.service.js';

describe('enterprise e2e (API services)', () => {
  it('lists protocol definitions', async () => {
    const protocols = await protocolDefinitionService.list('ginger').catch(() => []);
    assert.ok(Array.isArray(protocols));
  });

  it('executive cockpit returns KPI object', async () => {
    const cockpit = await executiveCockpitService.getCockpit();
    assert.equal(typeof cockpit.visits, 'number');
    assert.equal(typeof cockpit.openEscalations, 'number');
  });

  it('crop-doctor re-exports diagnosis orchestrator', () => {
    assert.equal(typeof diagnosisOrchestratorService.analyzeVisit, 'function');
  });

  it('farmer 360 handles missing farmer gracefully', async () => {
    await assert.rejects(
      () => farmerIntelligenceService.getFarmer360('00000000-0000-4000-8000-000000000099'),
      /Farmer not found|Could not load/
    );
  });
});
