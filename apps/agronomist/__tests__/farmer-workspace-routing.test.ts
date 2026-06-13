import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FARMER_WORKSPACE_TABS,
  FIELD_FINDINGS_KPI_LABELS,
  buildVisitRouteParams,
  kpiNavigatesToFieldFindings,
} from '../lib/farmer-workspace-routing';

describe('agronomist farmer workspace tabs', () => {
  it('includes fieldFindings tab and replaces visits tab', () => {
    const ids = FARMER_WORKSPACE_TABS.map((t) => t.id);
    assert.ok(ids.includes('fieldFindings'));
    assert.ok(!(ids as string[]).includes('visits'));
    assert.equal(FARMER_WORKSPACE_TABS.find((t) => t.id === 'fieldFindings')?.label, 'Field Findings');
  });
});

describe('agronomist overview KPI routing', () => {
  it('routes visit intelligence KPIs to fieldFindings', () => {
    for (const label of FIELD_FINDINGS_KPI_LABELS) {
      assert.equal(kpiNavigatesToFieldFindings(label), true);
    }
    assert.equal(kpiNavigatesToFieldFindings('Open tasks'), false);
  });
});

describe('agronomist start visit routing', () => {
  it('builds structured visit params with block context', () => {
    const route = buildVisitRouteParams({
      farmerId: 'farmer-1',
      farmerName: 'Ravi Kumar',
      leadId: 'lead-9',
      block: { id: 'block-2', name: 'North plot', cropType: 'Sugarcane' },
    });
    assert.equal(route.pathname, '/visit');
    assert.equal(route.params.farmerId, 'farmer-1');
    assert.equal(route.params.blockId, 'block-2');
    assert.equal(route.params.blockName, 'North plot');
    assert.equal(route.params.cropType, 'Sugarcane');
    assert.equal(route.params.farmerName, 'Ravi Kumar');
    assert.equal(route.params.leadId, 'lead-9');
  });
});
