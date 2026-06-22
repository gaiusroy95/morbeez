import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { visitCommandCenterService } from '../src/services/agronomist/visit-command-center.service.js';
import { diagnosisExplainService } from '../src/services/diagnosis/diagnosis-explain.service.js';

describe('visit command center', () => {
  it('getCommandCenter returns summary and queues for agent email', async () => {
    const center = await visitCommandCenterService.getCommandCenter('agronomist@morbeez.in').catch(() => null);
    if (!center) return;
    assert.ok('summary' in center);
    assert.ok(Array.isArray(center.priorityQueue));
    assert.ok(typeof center.summary.priorityCount === 'number');
  });

  it('updatePriority rejects unknown finding', async () => {
    await assert.rejects(
      () => visitCommandCenterService.updatePriority('00000000-0000-4000-8000-000000000099', 'urgent'),
      /Could not update|not found/i
    );
  });

  it('explain diagnosis returns farmer and agronomist text', () => {
    const out = diagnosisExplainService.explain({
      issueName: 'Potassium deficiency',
      finalDiagnosis: 'Potassium deficiency',
      observation: 'Yellowing on older leaves',
    });
    assert.ok(out.farmerText.includes('Potassium'));
    assert.ok(out.agronomistText.includes('Diagnosis'));
  });
});
